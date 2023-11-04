"use client";

import { useRef } from "react";
import Image from "next/image";

import loginIcon from "~/public/login.svg";
import logoutIcon from "~/public/logout.svg";

import { useAnonAuth } from "~/hooks/use-anon-auth";
import { Button } from "../Button/Button";
import { AuthDialog } from "../LoginDialog/AuthDialog";

export function MobileMenu() {
    const { username, logout } = useAnonAuth();

    const usernameDialogRef = useRef<HTMLDialogElement>(null);

    const openIdentityModal = () => {
        usernameDialogRef.current?.showModal();
    };

    if (username) {
        return (
            <div className="fixed bottom-0 w-full">
                <div className="flex w-full gap-2 p-2">
                    <p className="basis-10/12 py-3 text-center border border-black rounded-md shadow-inner bg-zinc-900">
                        {username}
                    </p>
                    <Button
                        theme="BASIC"
                        className="basis-2/12 py-3"
                        onClick={logout}
                    >
                        <Image
                            src={logoutIcon}
                            className="m-auto"
                            width={24}
                            height={24}
                            alt="login icon"
                        />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="fixed bottom-0 w-full">
                <div className="flex w-full">
                    <Button
                        theme="BASIC"
                        className="grow py-3 m-2"
                        onClick={openIdentityModal}
                    >
                        <Image
                            src={loginIcon}
                            className="m-auto"
                            width={24}
                            height={24}
                            alt="login icon"
                        />
                    </Button>
                </div>
            </div>
            {/* DIALOGS */}
            <AuthDialog ref={usernameDialogRef} />
        </>
    );
}
