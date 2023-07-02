import { LocalStorageKeys } from "~/constants";
import { Nullable, Values } from "./index";

type EventUserStore = {
    name: string;
};

export type StorageKey = Values<typeof LocalStorageKeys>;
export type StorageObject<T extends StorageKey> = T extends "event_user_name"
    ? Nullable<EventUserStore>
    : never;