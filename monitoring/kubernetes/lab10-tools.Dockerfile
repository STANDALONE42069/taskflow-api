FROM alpine:3.24

RUN apk add --no-cache bash coreutils curl git gzip tar unzip

COPY scripts/install-lab10-tools.sh /usr/local/share/install-lab10-tools.sh
RUN sed -i 's/\r$//' /usr/local/share/install-lab10-tools.sh && \
    WORKSPACE=/opt/taskflow-ci sh /usr/local/share/install-lab10-tools.sh
ENV TASKFLOW_CI_TOOL_CACHE=/opt/taskflow-ci/.tools/bin

ENV HOME=/home/jenkins/agent
USER 1000:1000
WORKDIR /home/jenkins/agent
