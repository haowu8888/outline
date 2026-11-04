"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "shares",
        "passwordHash",
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "shares",
        "expiresAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn("shares", "passwordHash", {
        transaction,
      });
      await queryInterface.removeColumn("shares", "expiresAt", { transaction });
    });
  },
};
