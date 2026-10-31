/** @type {import('next').NextConfig} */
export default {
  // Demo fixtures are read from disk at request time (process.cwd()), so make sure they ship with the serverless functions.
  outputFileTracingIncludes: {
    '/api/**/*': ['./fixtures/demo/**/*'],
  },
};
