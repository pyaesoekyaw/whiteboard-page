// Jenkinsfile for Real-time Collaborative Whiteboard Deployment

pipeline {
    // Define the agent where the pipeline will run. 'any' means any available agent.
    agent any

    // Define environment variables, especially for SSH connection to EC2
    environment {
        // Replace with your EC2 instance's public IP or DNS
        EC2_HOST = '52.70.145.81'
        // Replace with the SSH user (e.g., 'ubuntu' for Ubuntu AMIs, 'ec2-user' for Amazon Linux)
        EC2_USER = 'ubuntu'
        // Jenkins credential ID for your SSH private key (configured in Jenkins -> Credentials)
        SSH_CREDENTIAL_ID = 'your-ec2-ssh-key-credential-id' // <<-- Change this!
        // Path on EC2 where backend will be deployed
        BACKEND_REMOTE_DIR = '/home/ubuntu/app/backend'
        // Path on EC2 where frontend build will be copied and served by Nginx
        FRONTEND_REMOTE_DIR = '/var/www/html/whiteboard' // Nginx default serves from /var/www/html
    }

    // Stages define the logical steps of your pipeline
    stages {
        // Stage 1: Checkout the source code from your Git repository
        stage('Checkout Code') {
            steps {
                script {
                    // Clean workspace before checkout
                    sh 'rm -rf *'
                    // Checkout your Git repository
                    git branch: 'main', url: 'YOUR_GIT_REPOSITORY_URL' // <<-- Change this!
                }
            }
        }

        // Stage 2: Setup and Start the Node.js Backend
        stage('Deploy Backend') {
            steps {
                script {
                    // Ensure SSH agent is running and load credentials
                    sshagent(credentials: [env.SSH_CREDENTIAL_ID]) {
                        // Create remote directory if it doesn't exist
                        sh "ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} 'mkdir -p ${env.BACKEND_REMOTE_DIR}'"
                        // Copy backend files to EC2
                        sh "scp -o StrictHostKeyChecking=no -r backend/* ${env.EC2_USER}@${env.EC2_HOST}:${env.BACKEND_REMOTE_DIR}"

                        // Navigate to backend directory on EC2, install dependencies, and start/restart with PM2
                        sh """
                            ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} << 'EOF'
                            cd ${env.BACKEND_REMOTE_DIR}
                            npm install --production --force # --force to handle fsevents on Linux
                            pm2 delete whiteboard-backend || true # Delete if already running
                            pm2 start server.js --name whiteboard-backend # Start with PM2
                            pm2 save # Save PM2 process list
                            EOF
                        """
                    }
                }
            }
        }

        // Stage 3: Build the React Frontend
        stage('Build Frontend') {
            steps {
                script {
                    // Navigate to frontend directory
                    dir('frontend') {
                        // Install frontend dependencies (ignoring optional fsevents)
                        sh 'npm install --no-optional --force' // --force to handle fsevents on Linux
                        // Build the React application for production
                        sh 'npm run build'
                    }
                }
            }
        }

        // Stage 4: Deploy the React Frontend
        stage('Deploy Frontend') {
            steps {
                script {
                    // Ensure SSH agent is running and load credentials
                    sshagent(credentials: [env.SSH_CREDENTIAL_ID]) {
                        // Create remote directory for frontend if it doesn't exist
                        sh "ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} 'sudo mkdir -p ${env.FRONTEND_REMOTE_DIR}'"
                        // Remove old frontend files
                        sh "ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} 'sudo rm -rf ${env.FRONTEND_REMOTE_DIR}/*'"
                        // Copy built frontend files to EC2's Nginx serving directory
                        sh "scp -o StrictHostKeyChecking=no -r frontend/build/* ${env.EC2_USER}@${env.EC2_HOST}:${env.FRONTEND_REMOTE_DIR}"

                        // Restart Nginx to serve new frontend files
                        sh "ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} 'sudo systemctl restart nginx'"
                    }
                }
            }
        }
    }

    // Post-build actions (optional)
    post {
        always {
            echo 'Pipeline finished.'
        }
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed!'
        }
    }
}
