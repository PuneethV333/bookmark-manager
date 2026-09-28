import { Toaster } from "react-hot-toast";

const AppToaster = () => (
  <Toaster
    position="bottom-right"
    toastOptions={{
      duration: 4000,
      style: {
        background: "#141924",
        color: "#e4e4e7",
        border: "1px solid #283041",
        fontSize: "14px",
      },
      success: { iconTheme: { primary: "#34d399", secondary: "#090c12" } },
      error: { iconTheme: { primary: "#fb7185", secondary: "#090c12" } },
    }}
  />
);

export default AppToaster;
