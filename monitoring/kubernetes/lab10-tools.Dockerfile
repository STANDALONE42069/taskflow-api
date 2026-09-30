FROM alpine:3.24

RUN apk add --no-cache bash coreutils curl git gzip tar unzip

ENV HOME=/home/jenkins/agent
USER 1000:1000
WORKDIR /home/jenkins/agent
