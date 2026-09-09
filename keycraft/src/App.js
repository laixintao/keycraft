import DesignPage from "./pages/DesignPage";
import Home from "./pages/Home";

import "./App.css";
import { FocusStyleManager } from "@blueprintjs/core";
import { createBrowserRouter, createHashRouter, RouterProvider } from "react-router-dom";
import { isDesktop, WorkspaceProvider } from "./Workspace";

FocusStyleManager.onlyShowFocusOnTabs();

const router = (isDesktop ? createHashRouter : createBrowserRouter)([
  {
    path: "/snapshots/:profileId",
    element: <DesignPage />,
  },
  {
    path: "/",
    element: <Home />,
  },
]);

function App() {
  return (
    <WorkspaceProvider>
      <div className={`app-window${isDesktop ? " desktop-window" : ""}`}><RouterProvider router={router} /></div>
    </WorkspaceProvider>
  );
}

export default App;
