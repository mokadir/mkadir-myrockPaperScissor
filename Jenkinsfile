#!/usr/bin/env groovy
// =============================================================================
// RockPaperScissor — Jenkins CI/CD Pipeline for Kubernetes Deployment
// =============================================================================
// Builds and pushes a static game Docker image using Kaniko and optionally scans with Trivy.
// =============================================================================

pipeline {
    agent {
        kubernetes {
            label 'rockpaperscissor-kaniko-agent'
            defaultContainer 'tools'
            yaml '''
apiVersion: v1
kind: Pod
metadata:
  namespace: ns-jenkins
spec:
  serviceAccountName: jenkins
  containers:
    - name: tools
      image: node:20
      command: ['sh', '-c', 'cat']
      tty: true
    - name: kaniko
      image: gcr.io/kaniko-project/executor:v1.24.0-debug
      command: ['/busybox/sh', '-c', 'cat']
      tty: true
    - name: trivy
      image: aquasec/trivy:0.52.2
      command: ['sh', '-c', 'cat']
      tty: true
'''
        }
    }

    parameters {
        string(name: 'DOCKERHUB_ORG', defaultValue: 'mokadir', description: 'Docker Hub organisation/username')
        string(name: 'IMAGE_TAG', defaultValue: '${BUILD_NUMBER}', description: 'Image tag. Leave empty to auto-generate from branch+commit')
        string(name: 'GIT_BRANCH', defaultValue: 'main', description: 'Git branch to build from')
        choice(name: 'BUILD_ENV', choices: ['staging', 'production'], description: 'Target environment')
        booleanParam(name: 'RUN_CONTAINER_SCAN', defaultValue: true, description: 'Run Trivy image scan after build')
        booleanParam(name: 'PUSH_IMAGE', defaultValue: true, description: 'Push image to Docker Hub')
        booleanParam(name: 'PUSH_LATEST_TAG', defaultValue: true, description: 'Also push :latest on main/production')
        string(name: 'TRIVY_SEVERITY', defaultValue: 'HIGH,CRITICAL', description: 'Trivy severity threshold')
        booleanParam(name: 'FAIL_ON_VULN', defaultValue: false, description: 'Fail build on vulnerabilities')
        string(name: 'SLACK_CHANNEL', defaultValue: '', description: 'Optional Slack channel for notifications')
    }

    environment {
        DOCKERHUB_ORG  = "${params.DOCKERHUB_ORG}"
        BUILD_ENV      = "${params.BUILD_ENV}"
        TRIVY_SEVERITY = "${params.TRIVY_SEVERITY}"
        IMAGE_TAG      = "${params.IMAGE_TAG}"
        SHORT_SHA      = ''
        APP_NAME       = 'rockpaperscissor'
    }

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${params.GIT_BRANCH}"]],
                    extensions: [[$class: 'CleanBeforeCheckout']],
                    userRemoteConfigs: scm.userRemoteConfigs
                ])
            }
        }

        stage('Resolve Metadata') {
            steps {
                container('tools') {
                    script {
                        sh 'apt-get update -qq && apt-get install -y -qq git >/dev/null 2>&1'
                        sh 'git config --global --add safe.directory ${WORKSPACE}'
                        env.SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                        def rawTag = params.IMAGE_TAG?.trim()
                        def safeBranch = params.GIT_BRANCH.replaceAll('[^a-zA-Z0-9._-]', '-').toLowerCase()
                        env.IMAGE_TAG = rawTag ? rawTag : "${safeBranch}-${env.SHORT_SHA}"
                        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                        echo "  Application  : ${env.APP_NAME}"
                        echo "  Organisation : ${env.DOCKERHUB_ORG}"
                        echo "  Image Tag    : ${env.IMAGE_TAG}"
                        echo "  Branch       : ${params.GIT_BRANCH}"
                        echo "  Environment  : ${env.BUILD_ENV}"
                        echo "  Commit       : ${env.SHORT_SHA}"
                        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    }
                }
            }
        }

        stage('Preflight') {
            steps {
                container('tools') {
                    sh '''
                        set -eux
                        node --version
                        npm --version
                        cat Dockerfile
                    '''
                }
                container('kaniko') {
                    sh '/kaniko/executor version'
                }
                container('trivy') {
                    sh 'trivy --version'
                }
            }
        }

        stage('Prepare Registry Auth') {
            when { expression { params.PUSH_IMAGE } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-cred', usernameVariable: 'DOCKERHUB_USERNAME', passwordVariable: 'DOCKERHUB_PASSWORD')]) {
                    container('kaniko') {
                        sh '''
                            set -eux
                            mkdir -p /kaniko/.docker
                            cat > /kaniko/.docker/config.json <<EOF
{
  "auths": {
    "https://index.docker.io/v1/": {
      "username": "${DOCKERHUB_USERNAME}",
      "password": "${DOCKERHUB_PASSWORD}"
    }
  }
}
EOF
                        '''
                    }
                }
            }
        }

        stage('Build & Push Docker Image') {
            when { expression { params.PUSH_IMAGE } }
            steps {
                script {
                    def imageName = "${env.DOCKERHUB_ORG}/${env.APP_NAME}:${env.IMAGE_TAG}"
                    def kanikoCommand = "/kaniko/executor --context ${env.WORKSPACE} --dockerfile ${env.WORKSPACE}/Dockerfile --destination ${imageName}"

                    if (params.PUSH_LATEST_TAG) {
                        def latestTag = "${env.DOCKERHUB_ORG}/${env.APP_NAME}:latest"
                        kanikoCommand += " --destination ${latestTag}"
                    }

                    kanikoCommand += " --oci-layout-path /tmp/oci-layout"
                    container('kaniko') {
                        sh "set -eux; ${kanikoCommand}"
                    }
                }
            }
        }

        stage('Container Scan') {
            when { expression { params.RUN_CONTAINER_SCAN && params.PUSH_IMAGE } }
            steps {
                container('trivy') {
                    script {
                        def imageName = "${env.DOCKERHUB_ORG}/${env.APP_NAME}:${env.IMAGE_TAG}"
                        def trivyCmd = "trivy image --severity ${params.TRIVY_SEVERITY} ${imageName}"
                        if (!params.FAIL_ON_VULN) {
                            trivyCmd += ' || true'
                        }
                        sh "set -eux; ${trivyCmd}"
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                container('tools') {
                    script {
                        // Update namespace in all manifest files
                        sh """
                            sed -i 's|namespace: .*|namespace: ns-rockpaperscissor|g' k8s/*.yaml
                            sed -i 's|image: .*|image: ${env.DOCKERHUB_ORG}/${env.APP_NAME}:${env.IMAGE_TAG}|g' k8s/deployment.yaml
                        """
                        // Apply manifests to cluster
                        sh """
                            kubectl apply -f k8s/ -n ns-rockpaperscissor
                            kubectl rollout status deployment/rockpaperscissor-deployment -n ns-rockpaperscissor --timeout=120s
                        """
                    }
                }
            }
        }
    }
}