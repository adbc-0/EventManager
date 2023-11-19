import { postgres } from "~/services/postgres";
import { CurrentDate } from "../../../typescript/eventTypes";

export async function createMonth(date: CurrentDate, eventId: string) {
    const [month] = await postgres<{ id: number }[]>`
        INSERT INTO event.events_months (month, year, event_id)
        VALUES (${date.month}, ${date.year}, ${eventId})
        RETURNING id;
    `;

    return month;
}
