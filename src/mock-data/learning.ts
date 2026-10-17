export const domainExamples: Record<
  string,
  {
    intro: string;
    filename: string;
    lines: string[];
    question: string;
    options: string[];
    explanation: string;
  }
> = {
  rust: {
    intro:
      "先看函数调用前后的资源归属。借用期间允许访问数据，所有权仍留在调用者。",
    filename: "borrowing.rs",
    lines: [
      "fn inspect(text: &String) {",
      '    println!("{}", text);',
      "}",
      'let s = String::from("hello");',
      "inspect(&s);",
      'println!("{}", s);',
    ],
    question: "inspect(&s) 返回后，调用者还能使用 s 吗？",
    options: [
      "可以，调用者仍持有所有权",
      "不可以，所有权已移动",
      "只有复制整个 String 后才可以",
    ],
    explanation:
      "&s 传递的是引用。inspect 不取得 String 的所有权，函数返回后 s 仍可使用。",
  },
  sql: {
    intro:
      "先固定事务读取的时间点，再观察另一个事务提交后，当前事务能否看见新版本。",
    filename: "transaction.sql",
    lines: [
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;",
      "SELECT balance FROM accounts WHERE id = 1;",
      "-- 另一个事务更新并提交",
      "SELECT balance FROM accounts WHERE id = 1;",
      "COMMIT;",
    ],
    question:
      "在 PostgreSQL 的 REPEATABLE READ 事务中，两次普通 SELECT 会看到同一个快照吗？",
    options: [
      "会，事务继续使用同一快照",
      "不会，每次读取都获取最新版本",
      "第二次 SELECT 必然阻塞",
    ],
    explanation:
      "PostgreSQL 的 REPEATABLE READ 使用事务快照，其他事务之后提交的版本不会进入这个快照。",
  },
  infra: {
    intro:
      "从一次请求的执行路径看起：先处理输入 token，再逐步产生输出。缓存让历史键和值不必在每一步重新计算。",
    filename: "decode.py",
    lines: [
      "cache = prefill(prompt_tokens)",
      "for step in range(max_new_tokens):",
      "    token, cache = decode(last_token, cache)",
      "    output.append(token)",
      "    last_token = token",
    ],
    question: "KV Cache 主要避免在后续解码步骤中重复计算什么？",
    options: [
      "已有 token 的键和值",
      "当前 token 的所有计算",
      "最终输出文本的分词",
    ],
    explanation:
      "缓存保存此前 token 的键和值。新 token 仍需参与计算并更新缓存。",
  },
  os: {
    intro:
      "先区分虚拟地址和物理地址，再沿着地址转换路径观察查表、缓存命中和缺页处理。",
    filename: "address_translation.txt",
    lines: [
      "virtual_address = (virtual_page, offset)",
      "if TLB.contains(virtual_page):",
      "    physical_page = TLB.lookup(virtual_page)",
      "else:",
      "    physical_page = page_table.lookup(virtual_page)",
      "physical_address = (physical_page, offset)",
    ],
    question: "TLB 命中主要省去了哪一步？",
    options: ["常规的页表查找", "所有内存访问", "虚拟地址中的偏移计算"],
    explanation:
      "TLB 缓存地址转换结果。命中时可以直接得到物理页信息，不必沿常规路径查页表。",
  },
};
