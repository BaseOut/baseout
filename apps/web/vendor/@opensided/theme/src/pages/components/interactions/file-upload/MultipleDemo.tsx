import "filepond/dist/filepond.css";
import type { FilePondProps } from "react-filepond";
import { FilePond } from "react-filepond";

export const MultipleDemo = () => {
    const options: FilePondProps = {
        credits: false,
        allowMultiple: true,
        server: {
            process: (_, __, ___, load) => load({ message: "done" }),
        },
    };

    return <FilePond {...options} />;
};
