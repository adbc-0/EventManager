import { NextResponse } from "next/server";

import { AvailabilityEnumValues, DAYS_IN_WEEK, FreqEnum } from "~/constants";
import { hashId } from "~/services/hashId";
import { postgres } from "~/services/postgres";
import {
    DayJs,
    convertStringToDate,
    getCurrentDate,
    getNextOccurenceBeginning,
} from "~/services/dayJsFacade";
import {
    decodeEventParamDate,
    parseRule,
    validateEventParamDate,
} from "~/utils/eventUtils";
import {
    AvailabilityChoices,
    EventResponse,
    ID,
    ParsedRule,
} from "~/typescript";

type Event = {
    event_id: string;
    name: string;
};

type GroupedChoices = Record<string, AvailabilityChoices>;

type MonthsChoices = {
    choice: AvailabilityEnumValues;
    day: number;
    month_id: ID;
    month: number;
    year: number;
    username: string;
};

type Rule = {
    id: ID;
    choice: AvailabilityEnumValues;
    rule: string;
    start_date: Date;
    username: string;
};

type TransformedRule = Rule & {
    selectedDays: number[];
    parsedRule: ParsedRule;
};

type EventUser = {
    id: ID;
    username: string;
};

type RouteParams = {
    eventId: string;
};

type RequestParams = {
    params: RouteParams;
};

const DayToNoMap = {
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
    SU: 7,
} as const;

type DayToMapyKeys = Array<keyof typeof DayToNoMap>;

function getNextDayInstance(fromDate: DayJs) {
    return function (searchedWeekDay: number) {
        const startingDateDay = fromDate.day();
        if (searchedWeekDay === startingDateDay) {
            return fromDate;
        }
        if (searchedWeekDay > startingDateDay) {
            const daysDiff = searchedWeekDay - startingDateDay;
            return fromDate.add(daysDiff, "days").utc(true);
        }
        if (searchedWeekDay < startingDateDay) {
            const remainingWeekDays = DAYS_IN_WEEK - startingDateDay;
            const daysDiff = remainingWeekDays + searchedWeekDay;
            return fromDate.add(daysDiff, "days").utc(true);
        }
        throw new Error("MissingCondition Error");
    };
}

function generateDaysForInterval(interval: number) {
    return function generateDaysFromInitialDays(
        currentDate: DayJs,
        arr: number[] = [],
    ) {
        const appendedDays = [...arr, currentDate.date()];
        const nextDate = currentDate.add(interval, "days").utc(true);
        if (nextDate.month() !== currentDate.month()) {
            return appendedDays;
        }
        return generateDaysFromInitialDays(nextDate, appendedDays);
    };
}

/** TU,TH -> ['TU', 'TH'] */
function splitDayToNo(rule: ParsedRule) {
    return rule.BYDAY.split(",") as DayToMapyKeys;
}

function convertDateParamToFullDate(date: string) {
    const [month, year] = decodeEventParamDate(date);
    return `01-${Number.parseInt(month) + 1}-${year}`;
}

function getDaysFromRuleForMonth(date: string) {
    const startMonthDate = convertStringToDate(date).utc(true);
    return function (rule: ParsedRule, ruleCreationDate: Date) {
        const nextOccurenceBeginning = getNextOccurenceBeginning(
            rule.INTERVAL,
            ruleCreationDate,
            startMonthDate,
        );
        if (nextOccurenceBeginning.month() !== startMonthDate.month()) {
            return [];
        }

        const getNextOccurences = generateDaysForInterval(
            Number.parseInt(rule.INTERVAL) * DAYS_IN_WEEK,
        );

        if (rule.FREQ === FreqEnum.WEEKLY) {
            return splitDayToNo(rule)
                .map((dayLabel) => DayToNoMap[dayLabel])
                .map(getNextDayInstance(nextOccurenceBeginning))
                .flatMap((day) => getNextOccurences(day));
        }
        throw new Error("Rrule Error: unhandled FREQ of this rrule");
    };
}

function createNilChoices() {
    return {
        available: [],
        unavailable: [],
        maybe_available: [],
    };
}

function createEmptyUserChoices(users: EventUser[]) {
    return users.reduce((o, currUser) => {
        o[currUser.username] = createNilChoices();
        return o;
    }, {} as GroupedChoices);
}

function fillUsersAvailability(
    emptyChoices: GroupedChoices,
    eventMonthChoices: MonthsChoices[],
) {
    return eventMonthChoices.reduce((o, curr) => {
        const { username, choice, day } = curr;
        if (!o[username]) {
            throw new Error("Unexpected value: unexpected user id");
        }
        o[username][choice].push(day);
        return o;
    }, structuredClone(emptyChoices));
}

function fillUserAvailabilityWithRules(
    groupedChoices: GroupedChoices,
    rulesWithSearchedDays: TransformedRule[],
) {
    return rulesWithSearchedDays.reduce((o, curr) => {
        const { username, choice, selectedDays } = curr;
        if (!o[username]) {
            throw new Error("Unexpected value: unexpected user id");
        }
        const filteredChoices = preferManualChoiceOverRule(
            o[username],
            selectedDays,
        );
        o[username][choice] = dedupe([
            ...o[username][choice],
            ...filteredChoices,
        ]);
        return o;
    }, structuredClone(groupedChoices));
}

function dedupe(choices: number[]) {
    return [...new Set(choices)];
}

function preferManualChoiceOverRule(
    manualChoices: AvailabilityChoices,
    ruleDays: number[],
) {
    const mergedChoices = manualChoices.available
        .concat(manualChoices.maybe_available)
        .concat(manualChoices.unavailable);
    return ruleDays.filter(
        (day) => !mergedChoices.some((choice) => choice === day),
    );
}

export async function GET(request: Request, { params }: RequestParams) {
    const { searchParams } = new URL(request.url);

    const [eventId, decodingError] = hashId.decode(params.eventId);
    if (decodingError) {
        return NextResponse.json(
            { message: "Event not found" },
            { status: 404 },
        );
    }

    const inspectedDate =
        searchParams.get("date") ?? // format: MM-YYYY, MM starts from 0
        `${getCurrentDate().month}-${getCurrentDate().year}`;
    const isValid = validateEventParamDate(inspectedDate);
    if (isValid === false) {
        return NextResponse.json(
            { message: "Wrong event date param format" },
            { status: 400 },
        );
    }

    const [event] = await postgres<Event[]>`
        SELECT
            e.id AS event_id,
            e.name
        FROM event.events AS e
        WHERE e.id = ${eventId};
    `;
    if (!event) {
        return NextResponse.json(
            { message: "Event not found" },
            { status: 404 },
        );
    }

    const filterByDate = (rawDateParam: string) => {
        const [month, year] = decodeEventParamDate(rawDateParam);
        return postgres`
            AND m.year = ${year}
            AND m.month = ${month};
        `;
    };

    const eventMonthChoices = await postgres<MonthsChoices[]>`
        SELECT
            m.id AS month_id,
            m.month,
            m.year,
            c.day,
            c.choice,
            u.username
        FROM event.events_months AS m
        JOIN event.availability_choices AS c ON c.event_month_id=m.id
        JOIN event.events_users AS u ON u.id=c.user_id
        WHERE
            m.event_id=${event.event_id}
            ${filterByDate(inspectedDate)}
    `;

    const rules = await postgres<Rule[]>`
        SELECT
            r.id,
            r.choice,
            r.rule,
            r.start_date,
            u.username
        FROM event.availability_rules AS r
        JOIN event.events_users AS u ON u.id=r.user_id
        WHERE r.event_id=${event.event_id}
    `;

    const users = await postgres<EventUser[]>`
        SELECT id, username FROM event.events_users WHERE event_id = ${eventId};
    `;

    const inspectedFullDate = convertDateParamToFullDate(inspectedDate);
    const getDaysFromRule = getDaysFromRuleForMonth(inspectedFullDate);

    const groupedUsers = createEmptyUserChoices(users);
    const groupedChoices = fillUsersAvailability(
        groupedUsers,
        eventMonthChoices,
    );
    const rulesWithSearchedDays = rules
        .map((rule) => ({ ...rule, parsedRule: parseRule(rule.rule) }))
        .map((rule) => ({
            ...rule,
            selectedDays: getDaysFromRule(rule.parsedRule, rule.start_date),
        }));
    const choicesWithRules = fillUserAvailabilityWithRules(
        groupedChoices,
        rulesWithSearchedDays,
    );

    const response: EventResponse = {
        name: event.name,
        time: inspectedDate,
        groupedChoices: choicesWithRules,
    };
    return NextResponse.json(response);
}
