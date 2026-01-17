use('foodrena');

db.vendors.updateOne(
  { businessName: "kojo Kitchen" },
  {
    $set: {
      status: "verified",
      isOpen: true
    }
  }
);
