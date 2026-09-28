import Spinner from "./Spinner";

const PageLoader = () => (
  <div role="status" aria-label="Loading" className="grid min-h-screen place-items-center">
    <Spinner className="text-2xl text-emerald-400" />
  </div>
);

export default PageLoader;
