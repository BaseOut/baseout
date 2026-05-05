import { ISidebarMenuItem } from "@/components/admin-layout/SidebarMenuItem";

export const adminMenuItems: ISidebarMenuItem[] = [
    {
        id: "overview-label",
        isTitle: true,
        label: "Overview",
    },
    {
        id: "dashboards",
        icon: "lucide--monitor-dot",
        label: "Dashboard",
        children: [
            {
                id: "dashboards-ecommerce",
                label: "Ecommerce",
                url: "/dashboards/ecommerce",
            },
            {
                id: "dashboards-crm",
                label: "CRM",
                url: "/dashboards/crm",
            },
            {
                id: "dashboards-gen-ai",
                label: "Gen AI",
                url: "/dashboards/gen-ai",
            },
        ],
    },
    {
        id: "agentic-hub",
        icon: "lucide--bot-message-square",
        label: "Agentic Hub",
        children: [
            {
                id: "agentic-hub-storage",
                label: "Storage",
                url: "/agentic/storage",
                badges: ["new"],
            },
        ],
    },
    {
        id: "apps-label",
        isTitle: true,
        label: "Apps",
    },
    {
        id: "apps-ecommerce",
        icon: "lucide--store",
        label: "Ecommerce",
        children: [
            {
                id: "apps-ecommerce-orders",
                label: "Orders",
                url: "/apps/ecommerce/orders",
            },
            {
                id: "apps-ecommerce-products",
                label: "Products",
                url: "/apps/ecommerce/products",
            },
            {
                id: "apps-ecommerce-sellers",
                label: "Sellers",
                url: "/apps/ecommerce/sellers",
            },
            {
                id: "apps-ecommerce-customers",
                label: "Customers",
                url: "/apps/ecommerce/customers",
            },
            {
                id: "apps-ecommerce-shops",
                label: "Shops",
                url: "/apps/ecommerce/shops",
            },
        ],
    },
    {
        id: "apps-ai",
        icon: "lucide--brain-circuit",
        label: "Gen AI",
        children: [
            {
                id: "apps-ai-home",
                label: "Home",
                url: "/apps/gen-ai/home",
            },
            {
                id: "apps-ai-content",
                label: "Content",
                url: "/apps/gen-ai/content",
            },
            {
                id: "apps-ai-image",
                label: "Image",
                url: "/apps/gen-ai/image",
            },
            {
                id: "apps-ai-library",
                label: "Library",
                url: "/apps/gen-ai/library",
            },
        ],
    },
    {
        id: "apps-file-manager",
        icon: "lucide--server",
        label: "File Manager",
        url: "/apps/file-manager",
    },
    {
        id: "apps-chat",
        icon: "lucide--messages-square",
        label: "Chat",
        url: "/apps/chat",
    },

    {
        id: "label-other",
        isTitle: true,
        label: "Extras",
    },
    {
        id: "auth",
        icon: "lucide--shield-check",
        label: "Auth",
        children: [
            {
                id: "auth-login",
                label: "Login",
                url: "/auth/login",
            },
            {
                id: "auth-register",
                label: "Register",
                url: "/auth/register",
            },
            {
                id: "auth-forgot-password",
                label: "Forgot Password",
                url: "/auth/forgot-password",
            },
            {
                id: "auth-reset-password",
                label: "Reset Password",
                url: "/auth/reset-password",
            },
        ],
    },
    {
        id: "pages",
        icon: "lucide--files",
        label: "Pages",
        children: [
            {
                id: "pages-settings",
                label: "Settings",
                url: "/pages/settings",
            },
            {
                id: "pages-get-help",
                label: "Get Help",
                url: "/pages/get-help",
            },
        ],
    },
    {
        id: "landing",
        icon: "lucide--file",
        label: "Landing",
        url: "/landing",
        linkProp: {
            target: "_blank",
        },
    },
    {
        id: "layout-builder",
        icon: "lucide--blocks",
        label: "Layout Builder",
        url: "/layout-builder",
        badges: ["new"],
        linkProp: {
            target: "_blank",
        },
    },
];
