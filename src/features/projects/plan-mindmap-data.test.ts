import assert from "node:assert/strict";
import test from "node:test";
import { planMindmapData } from "./plan-mindmap-data.ts";
import { planMapFit } from "./plan-mindmap-fit.ts";
import type { PlanNode } from "./project-data.ts";
import type { MindElixirInstance } from "mind-elixir";
import {
  organicMainBranch,
  organicSubBranch,
} from "./plan-mindmap-branches.ts";

test("page fit uses the available width and grows vertically for a tall map", () => {
  const fit = planMapFit(1000, 2000, 832, 600, false)!;
  assert.equal(fit.scale * 1000, 800);
  assert.equal(fit.height, 1632);
});

test("fullscreen fit contains both dimensions without stretching or clipping", () => {
  const fit = planMapFit(1000, 2000, 832, 632, true)!;
  assert.equal(fit.scale, 0.3);
  assert.ok(fit.scale * 1000 + 32 <= 832);
  assert.ok(fit.scale * 2000 + 32 <= 632);
  assert.equal(planMapFit(0, 2000, 832, 632, true), null);
});

const nodes: PlanNode[] = [
  {
    id: 'topic"[]',
    title: "MySQL",
    description: "Database mechanisms",
    status: null,
    children: [
      {
        id: "index",
        title: "<img src=x onerror=alert(1)>",
        description: "Indexes",
        status: "completed",
        children: [],
      },
    ],
  },
];

test("branch endpoints join across both levels without doubling back on either side", () => {
  const context = {
    container: { style: { getPropertyValue: () => "36px" } },
  } as unknown as MindElixirInstance;
  const coordinates = (path: string) =>
    path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  for (const direction of ["lhs", "rhs"] as const) {
    const parent = { pT: 100, pL: 400, pW: 120, pH: 40 };
    const child = {
      cT: 40,
      cL: direction === "rhs" ? 650 : 160,
      cW: 140,
      cH: 38,
    };
    const main = coordinates(
      organicMainBranch.call(context, {
        pT: 200,
        pL: 300,
        pW: 100,
        pH: 60,
        cT: parent.pT,
        cL: parent.pL,
        cW: parent.pW,
        cH: parent.pH,
        direction,
        containerHeight: 800,
      }),
    );
    const branch = coordinates(
      organicSubBranch.call(context, {
        ...parent,
        ...child,
        direction,
        isFirst: true,
      }),
    );
    // 主枝有宽度，中心线必须恰好接到子枝的起点。
    assert.equal(main[6], branch[0]);
    assert.equal((main[7] + main[9]) / 2, branch[1]);
    const next = coordinates(
      organicSubBranch.call(context, {
        pT: child.cT,
        pL: child.cL,
        pW: child.cW,
        pH: child.cH,
        cT: 10,
        cL: direction === "rhs" ? 900 : -100,
        cW: 150,
        cH: 38,
        direction,
        isFirst: false,
      }),
    );
    assert.deepEqual(branch.slice(-2), next.slice(0, 2));
    const xs = [branch[0], branch[2], branch[4], branch[6], branch[8]];
    assert.ok(
      xs.every(
        (x, i) =>
          i === 0 || (direction === "rhs" ? x >= xs[i - 1] : x <= xs[i - 1]),
      ),
    );
  }
});

test("mind map is a two-sided projection with stable identities and literal titles", () => {
  const data = planMindmapData("project", "Backend", nodes);
  assert.equal(data.direction, 2);
  assert.equal(data.nodeData.id, "root:project");
  assert.equal(data.nodeData.children![0].id, "plan:topic%22%5B%5D");
  assert.equal(
    data.nodeData.children![0].children![0].topic,
    nodes[0].children[0].title,
  );
  assert.equal(
    data.nodeData.children![0].children![0].dangerouslySetInnerHTML,
    undefined,
  );
});

test("renderer expansion and parent metadata cannot mutate the persisted plan", () => {
  const before = structuredClone(nodes);
  const data = planMindmapData("project", "Backend", nodes);
  data.nodeData.children![0].expanded = false;
  data.nodeData.children![0].parent = data.nodeData;
  data.nodeData.children![0].children!.push({
    id: "extra",
    topic: "temporary",
  });
  assert.deepEqual(nodes, before);
  assert.deepEqual(data.nodeData.children![0].metadata, {
    description: "Database mechanisms",
    status: null,
  });
});
