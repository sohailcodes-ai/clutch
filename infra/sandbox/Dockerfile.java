FROM eclipse-temurin:21-jdk-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

RUN mkdir -p /workspace /tmp && chown sandbox:sandbox /workspace /tmp

USER sandbox
WORKDIR /workspace
