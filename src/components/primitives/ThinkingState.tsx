import { Shimmer } from "../atoms/Shimmer";
export default function ThinkingState() {
  return (
    <div className="py-4 text-[13px]" role="status">
      <Shimmer>正在思考</Shimmer>
    </div>
  );
}
