const Joi = require('joi');

// Group validation schema - only check basic information
const groupSchema = Joi.object({
  // Group information - required
  groupName: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Group name is required',
      'string.min': 'Group name must be at least 1 character',
      'string.max': 'Group name must not exceed 100 characters'
    }),
  
  // Student information - at least one student required
  student1: Joi.string().allow('').max(200).optional(),
  student2: Joi.string().allow('').max(200).optional(),
  student3: Joi.string().allow('').max(200).optional(),
  student4: Joi.string().allow('').max(200).optional(),
  student5: Joi.string().allow('').max(200).optional(),
  student6: Joi.string().allow('').max(200).optional(),
  student7: Joi.string().allow('').max(200).optional(),
  
  // All other fields are optional, allow empty values
  preference1: Joi.string().allow('').max(50).optional(),
  preference2: Joi.string().allow('').max(50).optional(),
  preference3: Joi.string().allow('').max(50).optional(),
  preference4: Joi.string().allow('').max(50).optional(),
  preference5: Joi.string().allow('').max(50).optional(),
  
  // WAM fields optional, allow empty values or numbers
  wamHD: Joi.alternatives().try(
    Joi.number().integer().min(0).max(7),
    Joi.string().allow('')
  ).optional(),
  wamD: Joi.alternatives().try(
    Joi.number().integer().min(0).max(7),
    Joi.string().allow('')
  ).optional(),
  wamCR: Joi.alternatives().try(
    Joi.number().integer().min(0).max(7),
    Joi.string().allow('')
  ).optional(),
  wamP: Joi.alternatives().try(
    Joi.number().integer().min(0).max(7),
    Joi.string().allow('')
  ).optional(),
  
  // Other fields are optional
  dualEnrollment: Joi.string().valid('yes', 'no', '').optional(),
  skills: Joi.array().items(Joi.string().max(50)).optional(),
  description: Joi.string().allow('').max(1000).optional(),
  startTime: Joi.string().allow('').optional(),
  finishTime: Joi.string().allow('').optional(),
  allocated_project: Joi.string().allow('').max(200).optional()
})
// Custom validation: ensure at least one student information is not empty
.custom((value, helpers) => {
  const students = [
    value.student1, value.student2, value.student3, 
    value.student4, value.student5, value.student6, value.student7
  ];
  
  const hasStudent = students.some(student => student && student.trim() !== '');
  
  if (!hasStudent) {
    return helpers.error('custom.no_students');
  }
  
  return value;
})
.messages({
  'custom.no_students': 'At least one student is required'
});

// Project validation schema
const projectSchema = Joi.object({
  projectName: Joi.string().min(1).max(200).required()
    .messages({
      'string.empty': 'Project name is required',
      'string.min': 'Project name must be at least 1 character',
      'string.max': 'Project name must not exceed 200 characters'
    }),
  
  maxGroups: Joi.alternatives().try(
    Joi.number().integer().min(1).max(100),
    Joi.string().allow('')
  ).optional(),
  
  client: Joi.string().allow('').max(200).optional(),
  
  description: Joi.string().allow('').max(3000).optional(),
  
  deliverables: Joi.string().allow('').max(2000).optional(),
  
  specificSkills: Joi.string().allow('').max(2000).optional(),
  
  resourcesProvided: Joi.string().allow('').max(2000).optional(),
  
  generalFields: Joi.string().allow('').max(1000).optional(),
  
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  
  courseCode: Joi.string().allow('').max(20).optional(),
  semester: Joi.string().allow('').max(20).optional(),
  projectType: Joi.string().allow('').max(50).optional(),
  deadline: Joi.string().allow('').optional(),
  
  startTime: Joi.string().allow('').optional(),
  
  finishTime: Joi.string().allow('').optional()
  ,
  // Accept optional projectId from frontend (e.g., "P01", "P02")
  projectId: Joi.string().trim().pattern(/^P\d+$/).optional(),
  // Also accept lowercase alias just in case
  projectid: Joi.string().trim().pattern(/^P\d+$/).optional()
});

// Login validation schema
const loginSchema = Joi.object({
  username: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Username is required',
      'string.min': 'Username must be at least 1 character',
      'string.max': 'Username must not exceed 100 characters'
    }),
  
  password: Joi.string().min(1).max(200).required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 1 character',
      'string.max': 'Password must not exceed 200 characters'
    })
});

// Validation middleware factory
function validateSchema(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Request validation failed',
        missingFields: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        })),
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: error.details.reduce((acc, detail) => {
            acc[detail.path.join('.')] = detail.message;
            return acc;
          }, {})
        }
      });
    }
    
    req.body = value;
    next();
  };
}

module.exports = {
  groupSchema,
  projectSchema,
  loginSchema,
  validateSchema
};
