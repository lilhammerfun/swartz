import type { LearningBook } from "../types/book";

export const learningBook: LearningBook = {
  id: "rust-memory",
  title: "Ownership & Borrowing",
  subtitle: "A personal guide to thinking in Rust",
  version: 1,
  chapters: [
    {
      id: "ownership",
      title: "Understanding ownership",
      purpose:
        "Establish who is responsible for a value before considering how it can be shared.",
      sections: [
        {
          id: "one-owner",
          title: "A value, an owner",
          subtitle: "Understanding ownership",
          paragraphs: [
            {
              id: "ownership-intro",
              text: "Every program needs a way to manage the memory it uses. Some languages rely on a garbage collector; others ask you to allocate and release memory yourself. Rust takes a different path: a set of ownership rules that the compiler checks before your program runs.",
            },
            {
              id: "ownership-rule",
              text: "Each value in Rust has an owner. There can only be one owner at a time, and when the owner goes out of scope, the value is dropped. These three rules give us a starting point for understanding how memory is managed.",
            },
            {
              id: "ownership-scope",
              text: "Think of ownership as responsibility rather than possession. The important question is not who can see a value, but who is responsible for keeping it alive and eventually cleaning it up.",
            },
            {
              id: "ownership-code",
              kind: "code",
              text: '{\n    let message = String::from("hello, Rust");\n    println!("{message}");\n} // message goes out of scope and is dropped',
            },
            {
              id: "ownership-next",
              text: "Within this scope, message is valid and can be used. Once the scope ends, Rust calls the value’s cleanup code. No separate instruction is needed to release its allocation.",
            },
          ],
        },
        {
          id: "moves",
          title: "Moving a value",
          subtitle: "Understanding ownership",
          paragraphs: [
            {
              id: "moves-intro",
              text: "Assigning a String to another variable transfers ownership. The data does not gain a second owner: instead, responsibility moves to a new binding. The original binding can no longer be used.",
            },
            {
              id: "moves-code",
              kind: "code",
              text: 'let original = String::from("a small idea");\nlet next = original;\n\nprintln!("{next}"); // valid\n// println!("{original}"); // the value has moved',
            },
            {
              id: "moves-reason",
              text: "Both variables might otherwise try to release the same allocation. By making the transfer explicit in its rules, Rust gives the value one clear path from creation to cleanup.",
            },
            {
              id: "moves-copy",
              text: "Small values such as integers can implement Copy. Assignment then copies the value, leaving both bindings valid. This distinction depends on the type, not simply on the spelling of the assignment.",
            },
          ],
        },
        {
          id: "drop",
          title: "Scope & cleanup",
          subtitle: "Understanding ownership",
          paragraphs: [
            {
              id: "drop-intro",
              text: "A scope gives ownership a visible boundary. At the end of that boundary, values are dropped in the reverse order in which they were created. This makes cleanup a property of the program’s structure.",
            },
            {
              id: "drop-detail",
              text: "A value may move to another owner before a scope ends. Follow the ownership transfer to understand which scope now determines the value’s lifetime.",
            },
          ],
        },
      ],
    },
    {
      id: "borrowing",
      title: "Borrowing & references",
      purpose:
        "Distinguish reading from modifying, then use that distinction to understand the rules of shared access.",
      sections: [
        {
          id: "shared",
          title: "Sharing without moving",
          subtitle: "Borrowing & references",
          paragraphs: [
            {
              id: "shared-intro",
              text: "Ownership answers who is responsible for a value. Borrowing asks a different question: how can another part of the program use that value without taking responsibility for it? A reference lets us do exactly that.",
            },
            {
              id: "shared-rule",
              text: "A shared reference allows you to read a value without moving it. You can have multiple shared references at the same time, because none of them can make conflicting changes to the value they observe.",
            },
            {
              id: "shared-code",
              kind: "code",
              text: 'let title = String::from("The shape of an idea");\nlet first_reader = &title;\nlet second_reader = &title;\n\nprintln!("{first_reader} · {second_reader}");',
            },
            {
              id: "shared-stable",
              text: "The useful promise is stability. While shared references are being used, the data they rely on cannot be changed through a conflicting mutable reference. Each reader can reason about what it sees.",
            },
            {
              id: "shared-note",
              text: "This is why it helps to understand borrowing as a way of organizing access. Counting ampersands is less useful than asking what each reference is allowed to do.",
            },
          ],
        },
        {
          id: "mutable",
          title: "The case for exclusive access",
          subtitle: "Borrowing & references",
          paragraphs: [
            {
              id: "mutable-intro",
              text: "Reading and modifying make different promises. A reader expects the value to remain stable; a writer may need to change its contents, its size, or even the location of its allocation. These expectations cannot always hold at the same time.",
            },
            {
              id: "mutable-rule",
              text: "A mutable reference gives you exclusive access to a value for the duration of that borrow. While the mutable reference is still in use, no other conflicting references may access that same value.",
            },
            {
              id: "mutable-reason",
              text: "The restriction is not an arbitrary limit on how many names a value can have. It prevents one part of a program from changing the very data another part is relying on. Exclusive access makes that boundary explicit.",
            },
            {
              id: "mutable-code",
              kind: "code",
              text: 'let mut idea = String::from("ownership");\nlet editor = &mut idea;\neditor.push_str(" makes responsibility visible");\n\nprintln!("{editor}");',
            },
            {
              id: "mutable-range",
              text: "A borrow’s active range is tied to where the reference is used. Once the last use is over, another borrow may begin. Look at the actual flow of access rather than assuming every borrow lasts to the closing brace.",
            },
            {
              id: "mutable-end",
              text: "Together, shared and mutable references describe two complementary ways to access a value. The owner remains responsible for cleanup; borrowing determines how others may participate before that happens.",
            },
          ],
        },
        {
          id: "conflicts",
          title: "Where borrows meet",
          subtitle: "Borrowing & references",
          paragraphs: [
            {
              id: "conflicts-intro",
              text: "Two references appearing in the same function do not necessarily conflict. To understand a borrow-checker error, identify the value involved, the kind of access each reference permits, and the places where those accesses are still needed.",
            },
            {
              id: "conflicts-method",
              text: "Start with the last use of each reference. If one borrow is finished before another begins, their access does not overlap. This small habit turns a compiler message into a question you can investigate in the code.",
            },
          ],
        },
      ],
    },
    {
      id: "lifetimes",
      title: "Lifetimes & validity",
      purpose:
        "Add the time dimension: a reference must remain inside the valid range of the value it refers to.",
      sections: [
        {
          id: "validity",
          title: "How long is a reference valid?",
          subtitle: "Lifetimes & validity",
          paragraphs: [
            {
              id: "validity-intro",
              text: "A reference is useful only while the value it points to still exists. Lifetimes express the boundaries within which references can be used safely. They connect access to the continued validity of its source.",
            },
            {
              id: "validity-detail",
              text: "Lifetime annotations describe relationships between references. They do not extend the life of a value. If the owner is gone, adding an annotation cannot make a dangling reference safe.",
            },
          ],
        },
        {
          id: "relationships",
          title: "Expressing relationships",
          subtitle: "Lifetimes & validity",
          paragraphs: [
            {
              id: "relationships-intro",
              text: "When a function accepts and returns references, its signature may need to describe how the returned reference relates to its inputs. This is a contract about validity rather than an instruction to allocate more memory.",
            },
          ],
        },
      ],
    },
  ],
};

export const initialLocation = {
  scale: "section",
  bookId: learningBook.id,
  chapterId: "borrowing",
  sectionId: "mutable",
} as const;
