import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css";
import "filepond/dist/filepond.css";
import type { FilePondProps } from "react-filepond";
import { FilePond, registerPlugin } from "react-filepond";

registerPlugin(FilePondPluginImagePreview);

export const ImagePreviewDemo = () => {
    const options: FilePondProps = {
        credits: false,
        server: {
            process: (_, __, ___, load) => load({ message: "done" }),
        },
    };

    return <FilePond {...options} />;
};
