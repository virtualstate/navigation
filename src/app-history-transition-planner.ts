import {
    AppHistoryTransition,
    AppHistoryTransitionNavigationType,
    AppHistoryTransitionWait,
    AppHistoryTransitionWhile,
} from "./app-history-transition";
import {AppHistory} from "./app-history";
import {AppHistoryEntry} from "./app-history-entry";
import {InvalidStateError} from "./app-history-errors";


export interface AppHistoryTransitionPlannerOptions {
    transition: AppHistoryTransition;
    currentPlan?: AppHistoryTransitionPlan;
    finishedTransitions?: Set<AppHistoryTransition>;
    constructAppHistory(): AppHistory;
}

export const AppHistoryTransitionPlanAppHistorySymbol = Symbol.for("@virtualstate/app-history/transition/plan/appHistory")
export const AppHistoryTransitionPlanWhile = Symbol.for("@virtualstate/app-history/transition/plan/while");
export const AppHistoryTransitionPlanWait = Symbol.for("@virtualstate/app-history/transition/plan/wait");

export interface AppHistoryTransitionPlan {
    [AppHistoryTransitionPlanAppHistorySymbol]: AppHistory;
    [AppHistoryTransitionPlanWhile](promise: Promise<unknown>): void;
    [AppHistoryTransitionPlanWait](): Promise<AppHistoryEntry>;
    transitions: AppHistoryTransition[];
    known: Set<AppHistoryEntry>
    knownTransitions: Set<AppHistoryTransition>;
    resolve(): Promise<void>;
}

export function plan(options: AppHistoryTransitionPlannerOptions) {
    const {
        transition,
        currentPlan,
        constructAppHistory,
        finishedTransitions,
    } = options;
    const nextPlan: AppHistoryTransitionPlan = {
        [AppHistoryTransitionPlanAppHistorySymbol]: currentPlan?.[AppHistoryTransitionPlanAppHistorySymbol] ?? constructAppHistory(),
        transitions: [],
        ...currentPlan,
        knownTransitions: new Set(currentPlan?.knownTransitions ?? []),
        [AppHistoryTransitionPlanWhile]: transition[AppHistoryTransitionWhile],
        [AppHistoryTransitionPlanWait]: transition[AppHistoryTransitionWait]
    };
    if (nextPlan.knownTransitions.has(transition)) {
        throw new InvalidStateError("Transition already found in plan, this may lead to unexpected behaviour, please raise an issue at ")
    }
    nextPlan.knownTransitions.add(transition);
    if (transition[AppHistoryTransitionNavigationType] === "traverse") {
        nextPlan.transitions.push(transition);
    } else {
        // Reset on non traversal
        nextPlan.transitions =
            []
                .concat([transition]);
    }
    nextPlan.transitions = nextPlan.transitions
        // Remove finished transitions
        .filter(transition => finishedTransitions?.has(transition));
    return nextPlan;
}