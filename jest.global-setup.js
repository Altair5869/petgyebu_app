// Run every test in a time zone west of Seoul, so code that mixes device-local and Seoul days fails
// here instead of only on devices abroad. Workers inherit this from the parent process.
module.exports = () => {
  process.env.TZ = 'America/New_York';
};
