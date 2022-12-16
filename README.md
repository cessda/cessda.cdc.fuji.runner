[![Build Status](https://jenkins.cessda.eu/buildStatus/icon?job=cessda.cdc.fuji.runner%2Fmain)](https://jenkins.cessda.eu/job/cessda.cdc.fuji-runner/job/main/)
[![Bugs](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=bugs)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Code Smells](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=code_smells)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Coverage](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=coverage)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Duplicated Lines (%)](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=duplicated_lines_density)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Lines of Code](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=ncloc)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Maintainability Rating](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=sqale_rating)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Quality Gate Status](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=alert_status)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Reliability Rating](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=reliability_rating)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Security Rating](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=security_rating)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Technical Debt](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=sqale_index)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)
[![Vulnerabilities](https://sonarqube.cessda.eu/api/project_badges/measure?project=eu.cessda.cdc.fuji.runner%3fuji-runner&metric=vulnerabilities)](https://sonarqube.cessda.eu/dashboard?id=eu.cessda.cdc.fuji.runner%3fuji-runner)

# CESSDA Data Catalogue: F-UJI Bulk Analysis Program

This repository contains the source code for the F-UJI Bulk Analysis Program.

## Prerequisites

Node 18 or higher is required to run this application.

## Quick Start

1. Check prerequisites and install any required software.
2. Clone the repository to your local workspace.
3. Run the application using the following command: `npm start`.

## Project Structure

This project uses the standard NPM project structure.

```text
<ROOT>
├── node_modules        # Third party packages and dependencies.
└── src                 # Contains all source code and assets for the application.
```

## Technology Stack

Several frameworks are used in this application.

The primary programming language is Flow and JSX in ECMAScript 6. See *Tooling* (below) for compatible IDEs.

| Framework/Technology                                  | Description                                              |
| ----------------------------------------------------- | -------------------------------------------------------- |
| [Elasticsearch](https://www.elastic.co/elasticsearch/)| Distributed, RESTful search engine and database          |
| [F-UJI](https://www.f-uji.net/)                       | REST API to assess FAIRness of research data objects     |
| [TypeScript](https://www.typescriptlang.org/)         | Static type checker for JavaScript.                      |
| [Winston](https://github.com/winstonjs/winston)       | JavaScript logging framework.                            |

See [`package.json`](package.json) in the root directory for a full list of third party libraries used.

## Configuration

## Contributing

Please read [CONTRIBUTING](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

See [Semantic Versioning](https://semver.org/) for guidance.

## Contributors

You can find the list of contributors in the [CONTRIBUTORS](CONTRIBUTORS.md) file.

## License

See the [LICENSE](LICENSE.txt) file.

## CITING

See the [CITATION](CITATION.cff) file.
