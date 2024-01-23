/**
# Copyright CESSDA ERIC 2017-2021
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/
pipeline {
	options {
		timeout(time: 1, unit: 'HOURS') // Abort a stalled build
	}

	environment {
		product_name = "cdc"
		module_name = "fuji-runner"
		image_tag = "${docker_repo}/${product_name}-${module_name}:${env.BRANCH_NAME.toLowerCase().replaceAll('[^a-z0-9\\.\\_\\-]', '-')}-${env.BUILD_NUMBER}"
		scannerHome = tool 'sonar-scanner'
	}

	agent {
		label 'jnlp-himem'
	}

	stages {
		//
		// No tests yet
		//
		stage('Run Unit Tests') {
			agent {
				docker {
					image 'node:18'
					reuseNode true
				}
			}
			steps {
				configFileProvider([configFile(fileId: 'be684558-5540-4ad6-a155-7c1b4278abc0', targetLocation: '.npmrc')]) {
					sh "npm ci"
				}
				// sh "npm test"
			}
			// post {
			// 	always {
			// 		junit 'junit.xml'
			// 	}
			// }
		}
		stage('Run Sonar Scan') {
			steps {
				nodejs('node-18') {
					withSonarQubeEnv('cessda-sonar') {
						sh "${scannerHome}/bin/sonar-scanner"
					}
				}
				waitForQualityGate abortPipeline: true
			}
			when { branch 'main' }
		}
		//
		// No Dockerfile yet
		//
		// stage('Build Docker image') {
		// 	 steps {
		// 		sh("docker build -t ${image_tag} .")
		// 	}
		// }
		// stage('Push Docker image') {
		// 	steps {
		// 		sh("gcloud auth configure-docker")
		// 		sh("docker push ${image_tag}")
		// 		sh("gcloud container images add-tag ${image_tag} ${docker_repo}/${product_name}-${module_name}:${env.BRANCH_NAME}-latest")
		// 	}
		// 	when { branch 'master' }
		// }
		// stage('Check Requirements and Deployments') {
		// 	steps {
		// 		build job: 'cessda.cdc.deploy/master', parameters: [string(name: 'searchkit_image_tag', value: "${env.BRANCH_NAME}-${env.BUILD_NUMBER}")], wait: false
		// 	}
		// 	when { branch 'master' }
		// }
	}
	post {
		failure {
			script {
				if (env.BRANCH_NAME == 'master') {
					emailext body: '${DEFAULT_CONTENT}', subject: '${DEFAULT_SUBJECT}', to: 'support@cessda.eu'
				}
			}
		}
	}
}
