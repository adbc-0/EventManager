export * from "./eventTypes";
export * from "./storageTypes";

export type Values<T> = T[keyof T];
export type Nullable<T> = T | null;
export type ReactProps = {
    children?: JSX.Element[] | JSX.Element | string | string[];
};
export type ErrorMessage = {
    message: string;
};
export type HashId = string;

// @unused
// Typings for div html node
// React.DetailedHTMLProps<
//     React.HTMLAttributes<HTMLDivElement>,
//     HTMLDivElement
// >
