import { FiLoader } from "react-icons/fi";
import { cn } from "../utils/cn";

const Spinner = ({ className }: { className?: string }) => (
  <FiLoader aria-hidden className={cn("animate-spin motion-reduce:animate-none", className)} />
);

export default Spinner;
