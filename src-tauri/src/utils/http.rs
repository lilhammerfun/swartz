//! Rig transport retaining the application's redirect, timeout, and response-size policies.

use rig::http_client::{
    Bytes, Error, HttpClientExt, LazyBody, MultipartForm, Request, Response, Result,
    StreamingResponse,
};

const MAX_RESPONSE: usize = 2 * 1024 * 1024;

#[derive(Clone)]
pub(crate) struct RigTransport(pub reqwest::Client);

impl HttpClientExt for RigTransport {
    fn send<T, U>(
        &self,
        request: Request<T>,
    ) -> impl Future<Output = Result<Response<LazyBody<U>>>> + Send + 'static
    where
        T: Into<Bytes> + Send,
        U: From<Bytes> + Send + 'static,
    {
        let (parts, body) = request.into_parts();
        let request = self
            .0
            .request(parts.method, parts.uri.to_string())
            .headers(parts.headers)
            .body(body.into());
        async move {
            let mut response = request.send().await.map_err(Error::instance)?;
            if !response.status().is_success() {
                let status = response.status();
                let headers = response.headers().clone();
                // Preserve HTTP classification without retaining an unbounded diagnostic body.
                let mut bytes = Vec::new();
                while let Some(chunk) = response.chunk().await.map_err(Error::instance)? {
                    let remaining = (64 * 1024usize).saturating_sub(bytes.len());
                    bytes.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
                    if bytes.len() == 64 * 1024 {
                        break;
                    }
                }
                return Err(Error::non_success_with_details(
                    status,
                    headers,
                    String::from_utf8_lossy(&bytes).into_owned(),
                ));
            }
            let mut builder = Response::builder().status(response.status());
            *builder.headers_mut().ok_or(Error::NoHeaders)? = response.headers().clone();
            let body: LazyBody<U> = Box::pin(async move {
                let mut bytes = Vec::new();
                while let Some(chunk) = response.chunk().await.map_err(Error::instance)? {
                    if bytes.len() + chunk.len() > MAX_RESPONSE {
                        return Err(Error::instance(std::io::Error::other(
                            "Model response size limit exceeded.",
                        )));
                    }
                    bytes.extend_from_slice(&chunk);
                }
                Ok(U::from(Bytes::from(bytes)))
            });
            Ok(builder.body(body)?)
        }
    }

    // LIMITATION: Tutor currently uses buffered text Responses only. Streaming and
    // multipart need their own bounded-body policy before enabling those features.
    fn send_multipart<U>(
        &self,
        _request: Request<MultipartForm>,
    ) -> impl Future<Output = Result<Response<LazyBody<U>>>> + Send + 'static
    where
        U: From<Bytes> + Send + 'static,
    {
        async {
            Err(Error::instance(std::io::Error::other(
                "Multipart model requests are not enabled.",
            )))
        }
    }

    fn send_streaming<T>(
        &self,
        _request: Request<T>,
    ) -> impl Future<Output = Result<StreamingResponse>> + Send
    where
        T: Into<Bytes> + Send,
    {
        async {
            Err(Error::instance(std::io::Error::other(
                "Streaming model requests are not enabled.",
            )))
        }
    }
}
