import type { IConfig } from "../../contexts/config";
import { useConfig } from "../../contexts/config";

const fontFamilies: { value: IConfig["fontFamily"]; label: string; className: string }[] = [
    {
        value: "default",
        label: "Jakarta",
        className: "group-[:not([data-font-family])]/html:bg-base-200",
    },
    {
        value: "inter",
        label: "Inter",
        className: "group-[[data-font-family=inter]]/html:bg-base-200",
    },
    {
        value: "outfit",
        label: "Outfit",
        className: "group-[[data-font-family=outfit]]/html:bg-base-200",
    },
    {
        value: "space-grotesk",
        label: "Space",
        className: "group-[[data-font-family=space-grotesk]]/html:bg-base-200",
    },
    {
        value: "dm-sans",
        label: "DM Sans",
        className: "group-[[data-font-family=dm-sans]]/html:bg-base-200",
    },
    {
        value: "wix",
        label: "Wix",
        className: "group-[[data-font-family=wix]]/html:bg-base-200",
    },
    {
        value: "inclusive",
        label: "Inclusive",
        className: "group-[[data-font-family=inclusive]]/html:bg-base-200",
    },
    {
        value: "ar-one",
        label: "AR One",
        className: "group-[[data-font-family=ar-one]]/html:bg-base-200",
    },
];

export const Rightbar = () => {
    const { toggleFullscreen, changeSidebarTheme, changeFontFamily, changeRadius, changeDirection, changeTheme, reset } = useConfig();

    const radiusOptions: { value: "default" | "none" | "sm" | "md" | "lg" | "pill"; label: string; preview: string; activeClass: string }[] = [
        { value: "default", label: "Auto",  preview: "var(--radius-box)", activeClass: "group-[:not([data-radius])]/html:bg-base-200" },
        { value: "none",    label: "None",  preview: "0px",               activeClass: "group-[[data-radius=none]]/html:bg-base-200" },
        { value: "sm",      label: "SM",    preview: "0.25rem",           activeClass: "group-[[data-radius=sm]]/html:bg-base-200" },
        { value: "md",      label: "MD",    preview: "0.5rem",            activeClass: "group-[[data-radius=md]]/html:bg-base-200" },
        { value: "lg",      label: "LG",    preview: "1rem",              activeClass: "group-[[data-radius=lg]]/html:bg-base-200" },
        { value: "pill",    label: "Pill",  preview: "20px",              activeClass: "group-[[data-radius=pill]]/html:bg-base-200" },
    ];

    return (
        <div className="drawer drawer-end">
            <input id="layout-rightbar-drawer" type="checkbox" className="drawer-toggle" />
            <div className="drawer-side z-50">
                <label
                    htmlFor="layout-rightbar-drawer"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                    aria-hidden
                />
                <div className="bg-base-100 text-base-content flex h-full w-76 flex-col sm:w-96">
                    <div className="bg-base-200/30 border-base-200 flex h-16 min-h-16 items-center justify-between border-b px-5">
                        <p className="text-lg font-medium">Customization</p>
                        <div className="inline-flex gap-1">
                            <button
                                className="btn-ghost btn btn-sm btn-circle relative"
                                onClick={reset}
                                aria-label="Reset">
                                <span className="iconify lucide--rotate-cw size-5" />
                                <span className="bg-error absolute end-0.5 top-0.5 rounded-full p-0 opacity-0 transition-all group-data-[changed]/html:p-[2px] group-data-[changed]/html:opacity-100"></span>
                            </button>
                            <button
                                className="btn btn-ghost btn-sm btn-circle"
                                onClick={toggleFullscreen}
                                aria-label="Full Screen">
                                <span className="iconify lucide--minimize hidden size-5 group-data-[fullscreen]/html:inline" />
                                <span className="iconify lucide--fullscreen inline size-5 group-data-[fullscreen]/html:hidden" />
                            </button>
                            <label
                                htmlFor="layout-rightbar-drawer"
                                aria-label="close sidebar"
                                aria-hidden
                                className="btn btn-ghost btn-sm btn-circle">
                                <span className="iconify lucide--x size-5" />
                            </label>
                        </div>
                    </div>
                    <div className="grow overflow-auto p-4 sm:p-5">
                        <p className="font-medium">Theme</p>
                        <p className="text-base-content/50 mt-3 mb-1.5 text-xs font-medium uppercase tracking-wider">Light</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(["snow", "light", "contrast", "material", "bloom"] as const).map((t) => (
                                <div
                                    key={t}
                                    data-theme={t}
                                    className="rounded-box group relative cursor-pointer"
                                    onClick={() => changeTheme(t)}>
                                    <div className="bg-base-200 rounded-box pt-4 pb-2.5 text-center">
                                        <div className="flex items-center justify-center gap-0.5">
                                            <span className="rounded-box bg-primary h-5 w-2.5"></span>
                                            <span className="rounded-box bg-secondary h-5 w-2.5"></span>
                                            <span className="rounded-box bg-accent h-5 w-2.5"></span>
                                            <span className="rounded-box bg-success h-5 w-2.5"></span>
                                        </div>
                                        <p className="mt-1 text-xs capitalize">{t}</p>
                                    </div>
                                    <span className={`bg-primary text-primary-content absolute end-1.5 top-1.5 rounded-full p-0 opacity-0 transition-all group-data-[theme=${t}]/html:p-1 group-data-[theme=${t}]/html:opacity-100`} />
                                </div>
                            ))}
                        </div>
                        <p className="text-base-content/50 mt-4 mb-1.5 text-xs font-medium uppercase tracking-wider">Dark</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(["midnight", "dark", "dim", "material-dark", "ocean"] as const).map((t) => (
                                <div
                                    key={t}
                                    data-theme={t}
                                    className="rounded-box group relative cursor-pointer"
                                    onClick={() => changeTheme(t)}>
                                    <div className="bg-base-200 rounded-box pt-4 pb-2.5 text-center">
                                        <div className="flex items-center justify-center gap-0.5">
                                            <span className="rounded-box bg-primary h-5 w-2.5"></span>
                                            <span className="rounded-box bg-secondary h-5 w-2.5"></span>
                                            <span className="rounded-box bg-accent h-5 w-2.5"></span>
                                            <span className="rounded-box bg-success h-5 w-2.5"></span>
                                        </div>
                                        <p className="mt-1 text-xs capitalize">{t === "material-dark" ? "mat. dark" : t}</p>
                                    </div>
                                    <span className={`bg-primary text-primary-content absolute end-1.5 top-1.5 rounded-full p-0 opacity-0 transition-all group-data-[theme=${t}]/html:p-1 group-data-[theme=${t}]/html:opacity-100`} />
                                </div>
                            ))}
                        </div>
                        <div className="pointer-events-none opacity-50 group-data-[theme=light]/html:pointer-events-auto group-data-[theme=light]/html:opacity-100 group-data-[theme=contrast]/html:pointer-events-auto group-data-[theme=contrast]/html:opacity-100 group-data-[theme=material]/html:pointer-events-auto group-data-[theme=material]/html:opacity-100 group-data-[theme=snow]/html:pointer-events-auto group-data-[theme=snow]/html:opacity-100 group-data-[theme=bloom]/html:pointer-events-auto group-data-[theme=bloom]/html:opacity-100">
                            <p className="mt-6 font-medium">
                                Sidebar
                                <span className="ms-1 inline text-xs group-data-[theme=light]/html:hidden group-data-[theme=contrast]/html:hidden group-data-[theme=material]/html:hidden group-data-[theme=snow]/html:hidden group-data-[theme=bloom]/html:hidden md:text-sm">
                                    (*Only available in light themes)
                                </span>
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div
                                    className="border-base-300 hover:bg-base-200 rounded-box group-data-[sidebar-theme=light]/html:bg-base-200 inline-flex cursor-pointer items-center justify-center gap-2 border p-2"
                                    onClick={() => changeSidebarTheme("light")}>
                                    <span className="iconify lucide--sun size-4.5" />
                                    Light
                                </div>
                                <div
                                    className="border-base-300 hover:bg-base-200 rounded-box group-data-[sidebar-theme=dark]/html:bg-base-200 inline-flex cursor-pointer items-center justify-center gap-2 border p-2"
                                    onClick={() => changeSidebarTheme("dark")}>
                                    <span className="iconify lucide--moon size-4.5" />
                                    Dark
                                </div>
                            </div>
                        </div>
                        <p className="mt-6 font-medium">Font Family</p>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            {fontFamilies.map((item, index) => (
                                <div
                                    key={index}
                                    className={
                                        "border-base-300 hover:bg-base-200 rounded-box inline-flex cursor-pointer items-center justify-center border p-2 text-sm " +
                                        item.className
                                    }
                                    onClick={() => changeFontFamily(item.value)}>
                                    <p data-font-family={item.value} className="font-sans truncate">
                                        {item.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-6 font-medium">Radius</p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            {radiusOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={`border-base-300 hover:bg-base-200 rounded-box cursor-pointer border p-2.5 text-center ${option.activeClass}`}
                                    onClick={() => changeRadius(option.value)}>
                                    <div
                                        className="bg-base-content/20 mx-auto h-5 w-8"
                                        style={{ borderRadius: option.preview }}
                                    />
                                    <p className="mt-1.5 text-xs">{option.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Direction — always LTR, no option needed */}
                        {/* <p className="mt-6 font-medium">Direction</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <div
                                className="border-base-300 hover:bg-base-200 rounded-box group-[[dir=ltr]]/html:bg-base-200 group-[:not([dir])]/html:bg-base-200 inline-flex cursor-pointer items-center justify-center gap-2 border p-2"
                                onClick={() => changeDirection("ltr")}>
                                <span className="iconify lucide--pilcrow-left size-4.5" />
                                <span className="hidden sm:inline">Left to Right</span>
                                <span className="inline sm:hidden">LTR</span>
                            </div>
                            <div
                                className="border-base-300 hover:bg-base-200 rounded-box group-[[dir=rtl]]/html:bg-base-200 inline-flex cursor-pointer items-center justify-center gap-2 border p-2"
                                onClick={() => changeDirection("rtl")}>
                                <span className="iconify lucide--pilcrow-right size-4.5" />
                                <span className="hidden sm:inline">Right to Right</span>
                                <span className="inline sm:hidden">RTL</span>
                            </div>
                        </div> */}
                    </div>
                </div>
            </div>
        </div>
    );
};
