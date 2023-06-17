export * from "./eventTypes";

export type Values<T> = T[keyof T];
export type Nullable<T> = T | null;
export type ReactProps = {
    children?: JSX.Element[] | JSX.Element | string;
};
export type HashId = string;

// Typing for div html node
// React.DetailedHTMLProps<
//     React.HTMLAttributes<HTMLDivElement>,
//     HTMLDivElement
// >
