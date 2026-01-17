use('foodrena');

db.vendors.updateOne(
  { businessName: "" },
  {
    $set: {
      status: "verified",
      isOpen: true
    }
  }
);
