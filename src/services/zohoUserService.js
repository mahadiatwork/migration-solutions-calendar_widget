export const getActiveUsersFromResponse = (response) => {
  const users = [
    response?.users,
    response?.data?.users,
    response?.data,
  ].find(Array.isArray);

  return (users || []).filter((user) => user?.status === "active");
};
