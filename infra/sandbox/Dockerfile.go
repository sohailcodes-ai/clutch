FROM golang:1.22-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

RUN mkdir -p /workspace /tmp && chown sandbox:sandbox /workspace /tmp

USER sandbox
WORKDIR /workspace

ENV GOCACHE=/tmp/gocache
ENV GOPATH=/tmp/gopath
