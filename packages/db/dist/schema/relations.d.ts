export declare const usersRelations: import("drizzle-orm").Relations<"users", {
    profile: import("drizzle-orm").One<"user_profiles", true>;
    sessions: import("drizzle-orm").Many<"auth_sessions">;
    stackRatings: import("drizzle-orm").Many<"user_stack_ratings">;
}>;
export declare const userProfilesRelations: import("drizzle-orm").Relations<"user_profiles", {
    user: import("drizzle-orm").One<"users", true>;
    equippedTitle: import("drizzle-orm").One<"titles", false>;
}>;
export declare const authSessionsRelations: import("drizzle-orm").Relations<"auth_sessions", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const stacksRelations: import("drizzle-orm").Relations<"stacks", {
    ratings: import("drizzle-orm").Many<"user_stack_ratings">;
}>;
export declare const rankTiersRelations: import("drizzle-orm").Relations<"rank_tiers", {
    ratings: import("drizzle-orm").Many<"user_stack_ratings">;
}>;
export declare const userStackRatingsRelations: import("drizzle-orm").Relations<"user_stack_ratings", {
    user: import("drizzle-orm").One<"users", true>;
    stack: import("drizzle-orm").One<"stacks", true>;
    tier: import("drizzle-orm").One<"rank_tiers", false>;
}>;
export declare const seasonsRelations: import("drizzle-orm").Relations<"seasons", {
    matches: import("drizzle-orm").Many<"matches">;
}>;
export declare const questionsRelations: import("drizzle-orm").Relations<"questions", {
    versions: import("drizzle-orm").Many<"question_versions">;
    stackSupport: import("drizzle-orm").Many<"question_stack_support">;
    topics: import("drizzle-orm").Many<"question_topics">;
}>;
export declare const questionStackSupportRelations: import("drizzle-orm").Relations<"question_stack_support", {
    question: import("drizzle-orm").One<"questions", true>;
    stack: import("drizzle-orm").One<"stacks", true>;
}>;
export declare const topicsRelations: import("drizzle-orm").Relations<"topics", {
    stack: import("drizzle-orm").One<"stacks", false>;
    questions: import("drizzle-orm").Many<"question_topics">;
}>;
export declare const questionTopicsRelations: import("drizzle-orm").Relations<"question_topics", {
    question: import("drizzle-orm").One<"questions", true>;
    topic: import("drizzle-orm").One<"topics", true>;
}>;
export declare const questionVersionsRelations: import("drizzle-orm").Relations<"question_versions", {
    question: import("drizzle-orm").One<"questions", true>;
    testCases: import("drizzle-orm").Many<"test_cases">;
}>;
export declare const testCasesRelations: import("drizzle-orm").Relations<"test_cases", {
    version: import("drizzle-orm").One<"question_versions", true>;
}>;
export declare const matchesRelations: import("drizzle-orm").Relations<"matches", {
    season: import("drizzle-orm").One<"seasons", true>;
    stack: import("drizzle-orm").One<"stacks", true>;
    questionVersion: import("drizzle-orm").One<"question_versions", true>;
    room: import("drizzle-orm").One<"rooms", false>;
    event: import("drizzle-orm").One<"events", false>;
    tournament: import("drizzle-orm").One<"tournaments", false>;
    participants: import("drizzle-orm").Many<"match_participants">;
    submissions: import("drizzle-orm").Many<"submissions">;
}>;
export declare const matchParticipantsRelations: import("drizzle-orm").Relations<"match_participants", {
    match: import("drizzle-orm").One<"matches", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const queueEntriesRelations: import("drizzle-orm").Relations<"queue_entries", {
    user: import("drizzle-orm").One<"users", true>;
    match: import("drizzle-orm").One<"matches", false>;
}>;
export declare const submissionsRelations: import("drizzle-orm").Relations<"submissions", {
    match: import("drizzle-orm").One<"matches", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const userTitlesRelations: import("drizzle-orm").Relations<"user_titles", {
    title: import("drizzle-orm").One<"titles", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const userQuestionStatsRelations: import("drizzle-orm").Relations<"user_question_stats", {
    question: import("drizzle-orm").One<"questions", true>;
}>;
export declare const roomsRelations: import("drizzle-orm").Relations<"rooms", {
    host: import("drizzle-orm").One<"users", true>;
    stack: import("drizzle-orm").One<"stacks", true>;
    difficulty: import("drizzle-orm").One<"difficulty_bands", false>;
    participants: import("drizzle-orm").Many<"room_participants">;
}>;
export declare const roomParticipantsRelations: import("drizzle-orm").Relations<"room_participants", {
    room: import("drizzle-orm").One<"rooms", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const eventsRelations: import("drizzle-orm").Relations<"events", {
    stacks: import("drizzle-orm").Many<"event_stacks">;
    difficultyLevels: import("drizzle-orm").Many<"event_difficulty_levels">;
    registrations: import("drizzle-orm").Many<"event_registrations">;
}>;
export declare const eventStacksRelations: import("drizzle-orm").Relations<"event_stacks", {
    event: import("drizzle-orm").One<"events", true>;
    stack: import("drizzle-orm").One<"stacks", true>;
}>;
export declare const eventDifficultyLevelsRelations: import("drizzle-orm").Relations<"event_difficulty_levels", {
    event: import("drizzle-orm").One<"events", true>;
    difficulty: import("drizzle-orm").One<"difficulty_bands", true>;
}>;
export declare const eventRegistrationsRelations: import("drizzle-orm").Relations<"event_registrations", {
    event: import("drizzle-orm").One<"events", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const tournamentsRelations: import("drizzle-orm").Relations<"tournaments", {
    season: import("drizzle-orm").One<"seasons", true>;
    stack: import("drizzle-orm").One<"stacks", true>;
    champion: import("drizzle-orm").One<"users", false>;
    registrations: import("drizzle-orm").Many<"tournament_registrations">;
    rounds: import("drizzle-orm").Many<"tournament_rounds">;
}>;
export declare const tournamentRegistrationsRelations: import("drizzle-orm").Relations<"tournament_registrations", {
    tournament: import("drizzle-orm").One<"tournaments", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const tournamentRoundsRelations: import("drizzle-orm").Relations<"tournament_rounds", {
    tournament: import("drizzle-orm").One<"tournaments", true>;
}>;
//# sourceMappingURL=relations.d.ts.map