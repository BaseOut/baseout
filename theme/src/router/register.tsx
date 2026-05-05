import { JSX, LazyExoticComponent, lazy } from "react";
import { Navigate, RouteProps } from "react-router";

export type IRoutesProps = {
    path: RouteProps["path"];
    element: RouteProps["element"];
};

// Component Wrapper
const cw = (Component: LazyExoticComponent<() => JSX.Element>) => {
    return <Component />;
};

const dashboardRoutes: IRoutesProps[] = [
    {
        path: "/dashboards/ecommerce",
        element: cw(lazy(() => import("@/pages/admin/dashboards/ecommerce"))),
    },
    {
        path: "/dashboards/crm",
        element: cw(lazy(() => import("@/pages/admin/dashboards/crm"))),
    },
    {
        path: "/dashboards/gen-ai",
        element: cw(lazy(() => import("@/pages/admin/dashboards/gen-ai"))),
    },
];

const appRoutes: IRoutesProps[] = [
    {
        path: "/agentic/storage",
        element: cw(lazy(() => import("@/pages/admin/agentic/storage"))),
    },
    {
        path: "/apps/ecommerce/products",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/products"))),
    },
    {
        path: "/apps/ecommerce/products/create",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/products/create"))),
    },
    {
        path: "/apps/ecommerce/products/:id",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/products/edit"))),
    },
    {
        path: "/apps/ecommerce/orders",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/orders"))),
    },
    {
        path: "/apps/ecommerce/orders/:id",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/orders/edit"))),
    },
    {
        path: "/apps/ecommerce/sellers",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/sellers"))),
    },
    {
        path: "/apps/ecommerce/sellers/create",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/sellers/create"))),
    },
    {
        path: "/apps/ecommerce/sellers/:id",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/sellers/edit"))),
    },
    {
        path: "/apps/ecommerce/customers",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/customers"))),
    },
    {
        path: "/apps/ecommerce/customers/create",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/customers/create"))),
    },
    {
        path: "/apps/ecommerce/customers/:id",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/customers/edit"))),
    },
    {
        path: "/apps/ecommerce/shops",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/shops"))),
    },
    {
        path: "/apps/ecommerce/shops/create",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/shops/create"))),
    },
    {
        path: "/apps/ecommerce/shops/:id",
        element: cw(lazy(() => import("@/pages/admin/apps/ecommerce/shops/edit"))),
    },
    {
        path: "/apps/gen-ai/home",
        element: cw(lazy(() => import("@/pages/admin/apps/gen-ai/home"))),
    },
    {
        path: "/apps/gen-ai/content",
        element: cw(lazy(() => import("@/pages/admin/apps/gen-ai/content"))),
    },
    {
        path: "/apps/gen-ai/image",
        element: cw(lazy(() => import("@/pages/admin/apps/gen-ai/image"))),
    },
    {
        path: "/apps/gen-ai/library",
        element: cw(lazy(() => import("@/pages/admin/apps/gen-ai/library"))),
    },
    {
        path: "/apps/file-manager",
        element: cw(lazy(() => import("@/pages/admin/apps/file-manager"))),
    },
    {
        path: "/apps/chat",
        element: cw(lazy(() => import("@/pages/admin/apps/chat"))),
    },
];

const componentRoutes: IRoutesProps[] = Object.entries(import.meta.glob("@/pages/components/**/*.tsx")).map(
    ([path, loader]) => {
        const routePath = path
            .replace(/^.*\/pages/, "")
            .replace(/\.tsx$/, "")
            .replace(/\/index$/, "");

        return {
            path: routePath,
            element: cw(lazy(loader as any)),
        };
    },
);

const authRoutes: IRoutesProps[] = [
    {
        path: "/auth/login",
        element: cw(lazy(() => import("@/pages/auth/login"))),
    },
    {
        path: "/auth/register",
        element: cw(lazy(() => import("@/pages/auth/register"))),
    },
    {
        path: "/auth/forgot-password",
        element: cw(lazy(() => import("@/pages/auth/forgot-password"))),
    },
    {
        path: "/auth/reset-password",
        element: cw(lazy(() => import("@/pages/auth/reset-password"))),
    },
];

const pagesRoutes: IRoutesProps[] = [
    {
        path: "/pages/settings",
        element: cw(lazy(() => import("@/pages/admin/pages/settings"))),
    },
    {
        path: "/pages/get-help",
        element: cw(lazy(() => import("@/pages/admin/pages/get-help"))),
    },
];

const otherRoutes: IRoutesProps[] = [
    {
        path: "/layout-builder",
        element: cw(lazy(() => import("@/pages/layout-builder"))),
    },
    {
        path: "/",
        element: cw(lazy(() => import("@/pages/landing"))),
    },
    {
        path: "/landing",
        element: cw(lazy(() => import("@/pages/landing"))),
    },
    {
        path: "/ui/*",
        element: <Navigate to="/components/" replace />,
    },
    {
        path: "/*",
        element: cw(lazy(() => import("@/pages/not-found"))),
    },
];

export const registerRoutes = {
    admin: [...dashboardRoutes, ...appRoutes, ...pagesRoutes],
    components: componentRoutes,
    auth: authRoutes,
    other: otherRoutes,
};
