import { initialMaps } from "./maps";
import type { MapData } from "../types/learning";

export const learningDomains = [
  { key: "rust", label: "Rust", monogram: "R" },
  { key: "sql", label: "数据库", monogram: "DB" },
  { key: "infra", label: "AI Infra", monogram: "AI" },
  { key: "os", label: "操作系统", monogram: "OS" },
];

export const learningMaps: Record<string, MapData> = {
  rust: initialMaps[0],
  infra: { ...initialMaps[1], id: "infra" },
  sql: {
    id: "sql",
    name: "数据库",
    description: "存储、查询与事务",
    source: "人工整理",
    nodes: [
      {
        id: "storage",
        label: "页与存储",
        subtitle: "数据的组织方式",
        mastery: 0.76,
        x: 70,
        y: 45,
        prerequisites: [],
      },
      {
        id: "index",
        label: "索引",
        subtitle: "定位候选记录",
        mastery: 0.52,
        x: 305,
        y: 158,
        prerequisites: ["storage"],
      },
      {
        id: "transaction",
        label: "事务",
        subtitle: "一次完整的状态变化",
        mastery: 0.39,
        x: 70,
        y: 158,
        prerequisites: ["storage"],
      },
      {
        id: "snapshot",
        label: "快照与版本",
        subtitle: "确定数据的可见性",
        mastery: null,
        x: 70,
        y: 272,
        prerequisites: ["transaction"],
      },
      {
        id: "planner",
        label: "执行计划",
        subtitle: "选择查询路径",
        mastery: 0.28,
        x: 305,
        y: 272,
        prerequisites: ["index"],
      },
      {
        id: "isolation",
        label: "隔离级别",
        subtitle: "约束并发观察",
        mastery: null,
        x: 185,
        y: 386,
        prerequisites: ["snapshot"],
      },
    ],
  },
  os: {
    id: "os",
    name: "操作系统",
    description: "从地址空间理解内存管理",
    source: "人工整理",
    nodes: [
      {
        id: "address",
        label: "地址空间",
        subtitle: "进程看到的内存",
        mastery: 0.68,
        x: 185,
        y: 45,
        prerequisites: [],
      },
      {
        id: "translation",
        label: "地址转换",
        subtitle: "虚拟地址到物理地址",
        mastery: 0.34,
        x: 70,
        y: 158,
        prerequisites: ["address"],
      },
      {
        id: "process",
        label: "进程与线程",
        subtitle: "运行状态与资源归属",
        mastery: 0.47,
        x: 305,
        y: 158,
        prerequisites: ["address"],
      },
      {
        id: "page",
        label: "页表与 TLB",
        subtitle: "映射与缓存",
        mastery: null,
        x: 70,
        y: 272,
        prerequisites: ["translation"],
      },
      {
        id: "schedule",
        label: "调度",
        subtitle: "切换执行上下文",
        mastery: null,
        x: 305,
        y: 272,
        prerequisites: ["process"],
      },
      {
        id: "fault",
        label: "缺页处理",
        subtitle: "恢复可访问的映射",
        mastery: 0.21,
        x: 185,
        y: 386,
        prerequisites: ["page"],
      },
    ],
  },
};

// Only concepts with a corresponding observation carry a seeded experimental estimate.
for (const [domain, map] of Object.entries(learningMaps)) {
  const observed = (
    { rust: "borrow", sql: "snapshot", infra: "cache", os: "page" } as Record<
      string,
      string
    >
  )[domain];
  map.nodes = map.nodes.map((node) => ({
    ...node,
    mastery: node.id === observed ? node.mastery : null,
  }));
}
