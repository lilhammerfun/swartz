//! Owns active conversation reservations and cancellation, not the Agent loop.

use std::{collections::HashMap, sync::Mutex};

use tokio::sync::watch;

use crate::models::conversations::ConversationTarget;

use super::TutorOutcome;

type RunKey = (String, String);

#[derive(Default)]
pub(super) struct ActiveRuns(Mutex<HashMap<RunKey, ActiveRun>>);

struct ActiveRun {
    target: ConversationTarget,
    cancel: watch::Sender<bool>,
}

impl ActiveRuns {
    pub(super) fn register(
        &self,
        owner: &str,
        request_id: &str,
        target: &ConversationTarget,
    ) -> Result<RunLease<'_>, String> {
        let mut runs = self
            .0
            .lock()
            .map_err(|_| "Could not access active Tutor runs.")?;
        let key = (owner.to_owned(), request_id.to_owned());
        if runs.contains_key(&key) || runs.values().any(|run| &run.target == target) {
            return Err("This conversation already has an active Tutor run.".into());
        }
        let (cancel, cancellation) = watch::channel(false);
        runs.insert(
            key.clone(),
            ActiveRun {
                target: target.clone(),
                cancel,
            },
        );
        Ok(RunLease {
            registry: self,
            key,
            cancellation,
            finished: false,
        })
    }

    pub(super) fn cancel(&self, owner: &str, request_id: &str) -> Result<bool, String> {
        let runs = self
            .0
            .lock()
            .map_err(|_| "Could not access active Tutor runs.")?;
        let Some(run) = runs.get(&(owner.to_owned(), request_id.to_owned())) else {
            return Ok(false);
        };
        run.cancel.send_replace(true);
        Ok(true)
    }

    pub(super) fn cancel_owner(&self, owner: &str) {
        if let Ok(runs) = self.0.lock() {
            for ((caller, _), run) in runs.iter() {
                if caller == owner {
                    run.cancel.send_replace(true);
                }
            }
        }
    }
}

/// A reservation lasts until finalization or drop, including failed preparation or notification.
/// No other operation removes this key, so Drop cannot remove a replacement run.
pub(super) struct RunLease<'a> {
    registry: &'a ActiveRuns,
    key: RunKey,
    cancellation: watch::Receiver<bool>,
    finished: bool,
}

impl RunLease<'_> {
    // Dropping the operation stops local execution; a provider or an already-started
    // blocking credential/file read may still finish independently.
    pub(super) async fn resolve(
        &mut self,
        operation: impl Future<Output = Result<String, String>>,
    ) -> TutorOutcome {
        tokio::select! {
            biased;
            _ = self.cancellation.wait_for(|cancelled| *cancelled) => TutorOutcome::Cancelled,
            answer = operation => match answer {
                Ok(text) => TutorOutcome::Completed { text },
                Err(error) => TutorOutcome::Failed { error },
            },
        }
    }

    pub(super) fn finish(mut self, outcome: TutorOutcome) -> Result<TutorOutcome, String> {
        // Cancellation and finalization share a lock: an acknowledged Stop wins over a late answer.
        let mut runs = self
            .registry
            .0
            .lock()
            .map_err(|_| "Could not finish the Tutor run.")?;
        let cancelled = *self.cancellation.borrow();
        runs.remove(&self.key);
        self.finished = true;
        Ok(if cancelled {
            TutorOutcome::Cancelled
        } else {
            outcome
        })
    }
}

impl Drop for RunLease<'_> {
    fn drop(&mut self) {
        if !self.finished
            && let Ok(mut runs) = self.registry.0.lock()
        {
            runs.remove(&self.key);
        }
    }
}
