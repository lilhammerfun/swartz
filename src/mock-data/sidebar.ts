export const workspace = { key: "tukdam", name: "Tukdam", monogram: "T" };
export const domainTopics = [
  {
    id: "rust",
    label: "Rust",
    topics: [
      "借用和移动的区别",
      "可变引用的边界",
      "生命周期如何约束引用",
      "谁负责释放 String",
      "栈与堆上的值",
      "Trait 与泛型",
      "Send 与 Sync",
      "用一个例子理解所有权",
    ],
  },
  {
    id: "sql",
    label: "数据库",
    topics: [
      "索引为什么能加速查询",
      "事务隔离与并发",
      "B+ 树的查找路径",
      "MVCC 与版本可见性",
      "执行计划与连接顺序",
      "分页查询的边界",
      "WAL 与故障恢复",
      "数据库的知识结构",
    ],
  },
  {
    id: "infra",
    label: "AI Infra",
    topics: [
      "Prefill 与 Decode",
      "KV Cache 的作用",
      "连续批处理的调度",
      "张量并行与流水线",
      "推理吞吐与延迟",
      "量化的误差来源",
      "注意力的计算路径",
      "一次请求的生命周期",
    ],
  },
  {
    id: "os",
    label: "操作系统",
    topics: [
      "虚拟地址如何被翻译",
      "页表与 TLB",
      "缺页异常的执行路径",
      "进程与线程",
      "调度与上下文切换",
      "写时复制",
      "文件描述符的归属",
      "内存管理的知识结构",
    ],
  },
];
export const sidebarSections = domainTopics.map((domain) => ({
  id: domain.id,
  label: domain.label,
  collapsible: true,
  items: domain.topics.map((label, i) => ({
    id: `${domain.id}-${i}`,
    label,
    prompt: `请用具体例子解释${label}。`,
  })),
}));
export const allRecents = sidebarSections.flatMap((s) => s.items);
