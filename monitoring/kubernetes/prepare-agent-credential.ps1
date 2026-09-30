$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$manifest = Join-Path $PSScriptRoot 'agent-namespace-rbac.yaml'
$secretDirectory = Join-Path $repoRoot 'monitoring\secrets'
$kubeconfigPath = Join-Path $secretDirectory 'jenkins-agents.kubeconfig'
$temporaryManifest = '/root/jenkins-agent-rbac.yaml'

New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null

docker cp $manifest "lab7-control-plane:$temporaryManifest" | Out-Null
try {
    docker exec lab7-control-plane kubectl --kubeconfig=/etc/kubernetes/admin.conf apply -f $temporaryManifest
}
finally {
    docker exec lab7-control-plane rm -f $temporaryManifest | Out-Null
}

$networks = docker inspect --format '{{range $name,$cfg := .NetworkSettings.Networks}}{{$name}} {{end}}' jenkins-lab
if (($networks -split '\s+') -notcontains 'kind') {
    docker network connect kind jenkins-lab
}
$jenkinsIp = docker inspect --format '{{.NetworkSettings.Networks.kind.IPAddress}}' jenkins-lab

$token = docker exec lab7-control-plane kubectl --kubeconfig=/etc/kubernetes/admin.conf `
    --namespace=jenkins-agents create token jenkins-agent --duration=24h
$server = docker exec lab7-control-plane kubectl --kubeconfig=/etc/kubernetes/admin.conf `
    config view --raw --minify -o 'jsonpath={.clusters[0].cluster.server}'
$caData = docker exec lab7-control-plane kubectl --kubeconfig=/etc/kubernetes/admin.conf `
    config view --raw --minify -o 'jsonpath={.clusters[0].cluster.certificate-authority-data}'

if ([string]::IsNullOrWhiteSpace($token) -or [string]::IsNullOrWhiteSpace($server) -or [string]::IsNullOrWhiteSpace($caData)) {
    Remove-Variable token -ErrorAction SilentlyContinue
    throw 'Could not create the scoped Kubernetes credential.'
}

$kubeconfig = @"
apiVersion: v1
kind: Config
clusters:
- name: lab7-kind
  cluster:
    certificate-authority-data: $caData
    server: $server
users:
- name: jenkins-agent
  user:
    token: $token
contexts:
- name: jenkins-agents
  context:
    cluster: lab7-kind
    namespace: jenkins-agents
    user: jenkins-agent
current-context: jenkins-agents
"@

Set-Content -Path $kubeconfigPath -Value $kubeconfig -Encoding utf8
Remove-Variable token, kubeconfig -ErrorAction SilentlyContinue

Write-Output "Created a 24-hour namespace-scoped kubeconfig at $kubeconfigPath"
Write-Output "Use Jenkins URL http://${jenkinsIp}:8080/ for agent pods and enable WebSocket in the Kubernetes cloud."
Write-Output 'Add that file to Jenkins as a Secret file credential; do not copy its contents into Git or chat.'
