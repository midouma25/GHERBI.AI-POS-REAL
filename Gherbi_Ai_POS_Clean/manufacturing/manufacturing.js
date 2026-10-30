/**
 * manufacturing/manufacturing.js
 * وحدة إدارة حالة التصنيع (BOM State & API Controller) في الواجهة الأمامية
 */

'use strict';

(function () {
  const ManufacturingState = {
    recipes: [],
    orders: [],
    productsList: [],
    currentRecipe: null,
    currentAvailability: null,

    async fetchAllData(filters = {}) {
      if (!window.api) return;
      const [recipes, orders, products] = await Promise.all([
        window.api.getBomRecipes(filters).catch(() => []),
        window.api.getProductionOrders(filters).catch(() => []),
        window.api.getProducts({}).catch(() => [])
      ]);

      this.recipes = Array.isArray(recipes) ? recipes : [];
      this.orders = Array.isArray(orders) ? orders : [];
      this.productsList = Array.isArray(products) ? products : [];
      return {
        recipes: this.recipes,
        orders: this.orders,
        products: this.productsList
      };
    },

    async checkAvailability(recipeId, plannedQty = 1) {
      if (!window.api || !recipeId) return null;
      this.currentAvailability = await window.api.getRecipeAvailability({
        recipeId: Number(recipeId),
        plannedQty: Number(plannedQty || 1)
      });
      return this.currentAvailability;
    },

    async saveRecipe(recipePayload) {
      if (!window.api) return null;
      const saved = await window.api.saveBomRecipe(recipePayload);
      await this.fetchAllData();
      return saved;
    },

    async removeRecipe(recipeId) {
      if (!window.api) return null;
      await window.api.deleteBomRecipe(Number(recipeId));
      await this.fetchAllData();
    },

    async createAndConfirmOrder(orderPayload) {
      if (!window.api) return null;
      const res = await window.api.createProductionOrder(orderPayload);
      await this.fetchAllData();
      return res;
    },

    async confirmDraftOrder(orderId, producedQty) {
      if (!window.api) return null;
      const res = await window.api.confirmProductionOrder({
        orderId: Number(orderId),
        produced_qty: producedQty ? Number(producedQty) : undefined
      });
      await this.fetchAllData();
      return res;
    },

    async reverseOrder(orderId) {
      if (!window.api) return null;
      const res = await window.api.reverseProductionOrder({ orderId: Number(orderId) });
      await this.fetchAllData();
      return res;
    }
  };

  window.ManufacturingManager = ManufacturingState;
})();