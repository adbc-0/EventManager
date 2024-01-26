import {
    Children,
    ElementRef,
    ReactElement,
    RefObject,
    cloneElement,
    createContext,
    isValidElement,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { ClosePaneButton } from "../GlassmorphicPane/ClosePane";
import { GlassmorphicPane } from "../GlassmorphicPane/GlassmorphicPane";
import { ReactProps, Nullable } from "~/typescript";

type DialogProps = ReactProps & {
    title?: string;
    fullscreen?: boolean;
};
type DialogContextT = {
    dialogRef: Nullable<RefObject<HTMLDialogElement>>;
    isOpen: boolean;
    startRenderingDialogChildren: () => void;
    stopRenderingDialogChildren: () => void;
    closeDialog: () => void;
    openDialog: () => void;
};

const DialogContext = createContext<DialogContextT>({
    dialogRef: null,
    isOpen: false,
    startRenderingDialogChildren: () => {
        throw new Error("unimplmeneted");
    },
    stopRenderingDialogChildren: () => {
        throw new Error("unimplmeneted");
    },
    openDialog: () => {
        throw new Error("unimplmeneted");
    },
    closeDialog: () => {
        throw new Error("unimplmeneted");
    },
});

export function useDialogContext() {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        throw new Error("wrap component with provider to use dialog context");
    }
    return ctx;
}

function Dialog({ children }: DialogProps) {
    const dialogRef = useRef<Nullable<ElementRef<"dialog">>>(null);
    const [isOpen, setIsOpen] = useState(false);
    const startRenderingDialogChildren = useCallback(() => {
        setIsOpen(true);
    }, []);
    const stopRenderingDialogChildren = useCallback(() => {
        setIsOpen(false);
    }, []);
    const openDialog = useCallback(() => {
        if (!dialogRef?.current) {
            throw new Error("dialog ref was not set properly");
        }
        dialogRef.current.showModal();
    }, []);
    const closeDialog = useCallback(() => {
        if (!dialogRef?.current) {
            throw new Error("dialog ref was not set properly");
        }
        dialogRef.current.close();
    }, []);
    const provider = useMemo(
        () => ({
            dialogRef,
            isOpen,
            startRenderingDialogChildren,
            stopRenderingDialogChildren,
            openDialog,
            closeDialog,
        }),
        [
            isOpen,
            startRenderingDialogChildren,
            stopRenderingDialogChildren,
            openDialog,
            closeDialog,
        ],
    );

    return (
        <DialogContext.Provider value={provider}>
            {children}
        </DialogContext.Provider>
    );
}

function DialogTrigger({ children }: DialogProps) {
    if (!children) {
        throw new Error("missing children");
    }

    const { openDialog } = useDialogContext();
    const triggerElement = Children.only(children);
    if (!isValidElement(triggerElement)) {
        throw new Error("invalid react element");
    }

    return cloneElement(triggerElement as ReactElement, {
        onClick: openDialog,
    });
}

function DialogTopBar({ title }: { title: string | undefined }) {
    const { closeDialog } = useDialogContext();
    return (
        <div className="flex justify-between bg-neutral-800 rounded-t-md p-2 items-center">
            <h2 className="text-xl">{title}</h2>
            <ClosePaneButton closeModal={closeDialog} />
        </div>
    );
}

function DialogContent({ children, title, fullscreen = false }: DialogProps) {
    const {
        dialogRef,
        isOpen,
        startRenderingDialogChildren,
        stopRenderingDialogChildren,
    } = useDialogContext();

    // stop rendering dialog when open attribute dissapears from native dialog
    useEffect(() => {
        if (dialogRef?.current) {
            const dialogObserver = new MutationObserver(() => {
                if (dialogRef.current?.open) {
                    startRenderingDialogChildren();
                    return;
                }
                stopRenderingDialogChildren();
            });
            dialogObserver.observe(dialogRef.current, { attributes: true });
            return () => {
                dialogObserver.disconnect();
            };
        }
    }, [dialogRef, startRenderingDialogChildren, stopRenderingDialogChildren]);

    return (
        <dialog
            ref={dialogRef}
            className="p-0 w-full rounded-md open:animate-fade-in"
        >
            {isOpen &&
                (fullscreen ? (
                    <GlassmorphicPane
                        outerClassName="md:max-w-3xl md:m-auto"
                        innerClassName="h-[calc(100dvh-8rem)]"
                    >
                        <div className="h-full flex flex-col">
                            <DialogTopBar title={title} />
                            <div className="p-2 grow">
                                <div className="relative h-full">
                                    <div className="absolute overflow-auto inset-0 shadow-md">
                                        {children}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </GlassmorphicPane>
                ) : (
                    <GlassmorphicPane
                        outerClassName="md:max-w-3xl md:m-auto" // alternative -> md:max-w-sm md:m-auto
                    >
                        <DialogTopBar title={title} />
                        <div className="p-2">{children}</div>
                    </GlassmorphicPane>
                ))}
        </dialog>
    );
}

function composeEventHandlers<E>(
    originalEventHandler?: (event: E) => void,
    ourEventHandler?: (event: E) => void,
    { checkForDefaultPrevented = true } = {},
) {
    return function handleEvent(event: E) {
        originalEventHandler?.(event);

        if (
            checkForDefaultPrevented === false ||
            !(event as unknown as Event).defaultPrevented
        ) {
            return ourEventHandler?.(event);
        }
    };
}

function DialogClose({ children }: DialogProps) {
    if (!children) {
        throw new Error("missing children");
    }

    const { closeDialog } = useDialogContext();
    const triggerElement = Children.only(children);
    if (!isValidElement(triggerElement)) {
        throw new Error("invalid react element");
    }

    const originalOnClick = triggerElement.props.onClick;

    return cloneElement(triggerElement as ReactElement, {
        onClick: composeEventHandlers(originalOnClick, closeDialog),
    });
}

Dialog.DialogClose = DialogClose;
Dialog.DialogTrigger = DialogTrigger;
Dialog.DialogContent = DialogContent;

export default Dialog;
