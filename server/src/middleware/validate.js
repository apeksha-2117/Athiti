/**
 * Returns a middleware that validates req.body against a Zod schema.
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), loginHandler)
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}
