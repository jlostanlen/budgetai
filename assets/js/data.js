// The dashboard consumes a stable API contract, independent of storage.
window.BudgetAPI = {
  async overview(month) {
    const response = await fetch('/api/dashboard/overview' + AccountFilter.query(month), {cache: 'no-store'});
    if (!response.ok) throw new Error('Budget indisponible. Réessayez dans un instant.');
    return response.json();
  },
};
