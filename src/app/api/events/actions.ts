"use server";

// ToDo: Add HashIds -> npm i hashids

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { postgres } from "~/services/postgres";

export async function DeleteEvent(eventId: string) {
    await postgres`
        DELETE FROM event.events WHERE id=${eventId};
    `;
    revalidatePath(`/calendar/${eventId}`);
}

const newEventSchema = z.object({
    event_name: z.string().trim().min(1).max(80),
});

type NewEventSchema = Partial<z.infer<typeof newEventSchema>>;

export async function AddEvent(newEvent: NewEventSchema) {
    const payload = newEventSchema.parse(newEvent);
    // ToDo: Take owner from token/storage
    const onwerId = 1;

    const event = {
        name: payload.event_name,
        owner_id: onwerId,
    };

    await postgres`INSERT INTO event.events ${postgres(
        event,
        "name",
        "owner_id",
    )};`;

    revalidatePath(`/events`);
}
