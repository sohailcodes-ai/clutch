import { relations } from 'drizzle-orm';
import { users, userProfiles, authSessions, stacks, rankTiers, userStackRatings, seasons, questions, questionVersions, questionStackSupport, topics, questionTopics, testCases, matches, matchParticipants, queueEntries, submissions, difficultyBands, titles, userTitles, userQuestionStats, rooms, roomParticipants, events, eventStacks, eventDifficultyLevels, eventRegistrations, tournaments, tournamentRegistrations, tournamentRounds, } from './index.js';
export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
    sessions: many(authSessions),
    stackRatings: many(userStackRatings),
}));
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
    user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
    equippedTitle: one(titles, {
        fields: [userProfiles.equippedTitleId],
        references: [titles.id],
    }),
}));
export const authSessionsRelations = relations(authSessions, ({ one }) => ({
    user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));
export const stacksRelations = relations(stacks, ({ many }) => ({
    ratings: many(userStackRatings),
}));
export const rankTiersRelations = relations(rankTiers, ({ many }) => ({
    ratings: many(userStackRatings),
}));
export const userStackRatingsRelations = relations(userStackRatings, ({ one }) => ({
    user: one(users, { fields: [userStackRatings.userId], references: [users.id] }),
    stack: one(stacks, { fields: [userStackRatings.stackId], references: [stacks.id] }),
    tier: one(rankTiers, { fields: [userStackRatings.tierId], references: [rankTiers.id] }),
}));
export const seasonsRelations = relations(seasons, ({ many }) => ({
    matches: many(matches),
}));
export const questionsRelations = relations(questions, ({ one, many }) => ({
    versions: many(questionVersions),
    stackSupport: many(questionStackSupport),
    topics: many(questionTopics),
}));
export const questionStackSupportRelations = relations(questionStackSupport, ({ one }) => ({
    question: one(questions, {
        fields: [questionStackSupport.questionId],
        references: [questions.id],
    }),
    stack: one(stacks, { fields: [questionStackSupport.stackId], references: [stacks.id] }),
}));
export const topicsRelations = relations(topics, ({ one, many }) => ({
    stack: one(stacks, { fields: [topics.stackId], references: [stacks.id] }),
    questions: many(questionTopics),
}));
export const questionTopicsRelations = relations(questionTopics, ({ one }) => ({
    question: one(questions, {
        fields: [questionTopics.questionId],
        references: [questions.id],
    }),
    topic: one(topics, { fields: [questionTopics.topicId], references: [topics.id] }),
}));
export const questionVersionsRelations = relations(questionVersions, ({ one, many }) => ({
    question: one(questions, { fields: [questionVersions.questionId], references: [questions.id] }),
    testCases: many(testCases),
}));
export const testCasesRelations = relations(testCases, ({ one }) => ({
    version: one(questionVersions, {
        fields: [testCases.questionVersionId],
        references: [questionVersions.id],
    }),
}));
export const matchesRelations = relations(matches, ({ one, many }) => ({
    season: one(seasons, { fields: [matches.seasonId], references: [seasons.id] }),
    stack: one(stacks, { fields: [matches.stackId], references: [stacks.id] }),
    questionVersion: one(questionVersions, {
        fields: [matches.questionVersionId],
        references: [questionVersions.id],
    }),
    room: one(rooms, { fields: [matches.roomId], references: [rooms.id] }),
    event: one(events, { fields: [matches.eventId], references: [events.id] }),
    tournament: one(tournaments, {
        fields: [matches.tournamentId],
        references: [tournaments.id],
    }),
    participants: many(matchParticipants),
    submissions: many(submissions),
}));
export const matchParticipantsRelations = relations(matchParticipants, ({ one }) => ({
    match: one(matches, { fields: [matchParticipants.matchId], references: [matches.id] }),
    user: one(users, { fields: [matchParticipants.userId], references: [users.id] }),
}));
export const queueEntriesRelations = relations(queueEntries, ({ one }) => ({
    user: one(users, { fields: [queueEntries.userId], references: [users.id] }),
    match: one(matches, { fields: [queueEntries.matchId], references: [matches.id] }),
}));
export const submissionsRelations = relations(submissions, ({ one }) => ({
    match: one(matches, { fields: [submissions.matchId], references: [matches.id] }),
    user: one(users, { fields: [submissions.userId], references: [users.id] }),
}));
export const userTitlesRelations = relations(userTitles, ({ one }) => ({
    title: one(titles, { fields: [userTitles.titleId], references: [titles.id] }),
    user: one(users, { fields: [userTitles.userId], references: [users.id] }),
}));
export const userQuestionStatsRelations = relations(userQuestionStats, ({ one }) => ({
    question: one(questions, { fields: [userQuestionStats.questionId], references: [questions.id] }),
}));
export const roomsRelations = relations(rooms, ({ one, many }) => ({
    host: one(users, { fields: [rooms.hostUserId], references: [users.id] }),
    stack: one(stacks, { fields: [rooms.stackId], references: [stacks.id] }),
    difficulty: one(difficultyBands, {
        fields: [rooms.difficultyId],
        references: [difficultyBands.id],
    }),
    participants: many(roomParticipants),
}));
export const roomParticipantsRelations = relations(roomParticipants, ({ one }) => ({
    room: one(rooms, { fields: [roomParticipants.roomId], references: [rooms.id] }),
    user: one(users, { fields: [roomParticipants.userId], references: [users.id] }),
}));
export const eventsRelations = relations(events, ({ many }) => ({
    stacks: many(eventStacks),
    difficultyLevels: many(eventDifficultyLevels),
    registrations: many(eventRegistrations),
}));
export const eventStacksRelations = relations(eventStacks, ({ one }) => ({
    event: one(events, { fields: [eventStacks.eventId], references: [events.id] }),
    stack: one(stacks, { fields: [eventStacks.stackId], references: [stacks.id] }),
}));
export const eventDifficultyLevelsRelations = relations(eventDifficultyLevels, ({ one }) => ({
    event: one(events, { fields: [eventDifficultyLevels.eventId], references: [events.id] }),
    difficulty: one(difficultyBands, {
        fields: [eventDifficultyLevels.difficultyId],
        references: [difficultyBands.id],
    }),
}));
export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
    event: one(events, { fields: [eventRegistrations.eventId], references: [events.id] }),
    user: one(users, { fields: [eventRegistrations.userId], references: [users.id] }),
}));
export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
    season: one(seasons, { fields: [tournaments.seasonId], references: [seasons.id] }),
    stack: one(stacks, { fields: [tournaments.stackId], references: [stacks.id] }),
    champion: one(users, {
        fields: [tournaments.championUserId],
        references: [users.id],
    }),
    registrations: many(tournamentRegistrations),
    rounds: many(tournamentRounds),
}));
export const tournamentRegistrationsRelations = relations(tournamentRegistrations, ({ one }) => ({
    tournament: one(tournaments, {
        fields: [tournamentRegistrations.tournamentId],
        references: [tournaments.id],
    }),
    user: one(users, { fields: [tournamentRegistrations.userId], references: [users.id] }),
}));
export const tournamentRoundsRelations = relations(tournamentRounds, ({ one }) => ({
    tournament: one(tournaments, {
        fields: [tournamentRounds.tournamentId],
        references: [tournaments.id],
    }),
}));
//# sourceMappingURL=relations.js.map