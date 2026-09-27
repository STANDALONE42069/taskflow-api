package security

import rego.v1

default deny := false

deny if {
	input.metadata.vulnerabilities.critical > 0
}
