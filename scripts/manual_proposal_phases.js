// This script creates proposal phases based on manual PDF text extraction
// The phase data is extracted from the "Compensation:" sections of proposal PDFs

const phases = [
  // 23-01 Nocatee Crosswater Commercial Parcel
  { proposal_number: '23-01', phase_code: 'A1', phase_name: 'Preliminary Site Plan', amount: 1500, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'A2', phase_name: 'Revisions to the Preliminary Site Plan', amount: 3500, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'A3', phase_name: 'Master Development Plan', amount: 5000, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'A4', phase_name: 'Engineering Plan Preparation', amount: 30000, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'A5', phase_name: 'Permitting', amount: 13000, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'A6', phase_name: 'Site Lighting', amount: 3000, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'A7', phase_name: 'FPL, AT&T, Comcast Support', amount: 4000, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'A8', phase_name: 'Project Meetings', amount: 1500, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'GEO', phase_name: 'Geotechnical Exploration', amount: 2760, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'SURV', phase_name: 'Survey, Topo, and SUE', amount: 17150, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'LA1', phase_name: 'Code Landscape Design', amount: 6000, billing_type: 'L' },
  { proposal_number: '23-01', phase_code: 'CA', phase_name: 'Final Certs and Construction Admin.', amount: 15000, billing_type: 'H' },

  // 24-04 Ranch Road Townhomes
  { proposal_number: '24-04', phase_code: 'A1', phase_name: 'PUD Verification', amount: 5000, billing_type: 'L' },
  { proposal_number: '24-04', phase_code: 'A2', phase_name: 'Engineering Plan Preparation', amount: 60000, billing_type: 'L' },
  { proposal_number: '24-04', phase_code: 'A3', phase_name: 'Lift Station and Onsite Force Main', amount: 8000, billing_type: 'L' },
  { proposal_number: '24-04', phase_code: 'A4', phase_name: 'Permitting', amount: 14000, billing_type: 'L' },
  { proposal_number: '24-04', phase_code: 'A5', phase_name: 'JEA Electric, AT&T, and Comcast Support', amount: 6000, billing_type: 'L' },
  { proposal_number: '24-04', phase_code: 'CA', phase_name: 'Final Certs. & Construction Obser.', amount: 12000, billing_type: 'H' },
  { proposal_number: '24-04', phase_code: 'LA1', phase_name: 'Code Landscape Design', amount: 8000, billing_type: 'L' },

  // 25-08 US-1 Flex Space
  { proposal_number: '25-08', phase_code: 'C1', phase_name: 'Preliminary Site Planning', amount: 2500, billing_type: 'L' },
  { proposal_number: '25-08', phase_code: 'C2', phase_name: 'Master Development Plan', amount: 5000, billing_type: 'L' },
  { proposal_number: '25-08', phase_code: 'C3', phase_name: 'Engineering Plan Preparation', amount: 52000, billing_type: 'L' },
  { proposal_number: '25-08', phase_code: 'C4', phase_name: 'Lift Station and Onsite Force Main', amount: 7000, billing_type: 'L' },
  { proposal_number: '25-08', phase_code: 'C5', phase_name: 'Site Lighting', amount: 3000, billing_type: 'L' },
  { proposal_number: '25-08', phase_code: 'C6', phase_name: 'Permitting', amount: 18000, billing_type: 'H' },
  { proposal_number: '25-08', phase_code: 'C7', phase_name: 'JEA, AT&T, Comcast Support', amount: 4000, billing_type: 'H' },
  { proposal_number: '25-08', phase_code: 'CA', phase_name: 'Final Certifications & Construction Observation', amount: 15000, billing_type: 'H' },
];

module.exports = phases;

// For testing
if (require.main === module) {
  console.log('Total phases:', phases.length);
  console.log('Sample:', phases.slice(0, 3));
}
