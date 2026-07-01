const Package = require('../../models/Package');

// @desc    Get all packages
// @route   GET /api/admin/packages
const getPackages = async (req, res, next) => {
    try {
        const packages = await Package.find().sort({ sortOrder: 1, createdAt: -1 });
        return res.json({ success: true, packages });
    } catch (err) {
        next(err);
    }
};

// @desc    Create package
// @route   POST /api/admin/packages
const createPackage = async (req, res, next) => {
    try {
        const { totalCoin, amount, status } = req.body;
        if (totalCoin === undefined || amount === undefined) {
            return res.status(400).json({ success: false, message: 'Total Coin and Amount are required' });
        }

        const pkg = await Package.create({
            totalCoin: Number(totalCoin),
            amount: Number(amount),
            status: status !== undefined ? Number(status) : 1,
        });

        return res.status(201).json({ success: true, package: pkg });
    } catch (err) {
        next(err);
    }
};

// @desc    Update package
// @route   PUT /api/admin/packages/:id
const updatePackage = async (req, res, next) => {
    try {
        const { totalCoin, amount, status } = req.body;
        const pkg = await Package.findById(req.params.id);
        if (!pkg) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }

        if (totalCoin !== undefined) pkg.totalCoin = Number(totalCoin);
        if (amount !== undefined) pkg.amount = Number(amount);
        if (status !== undefined) pkg.status = Number(status);

        await pkg.save();
        return res.json({ success: true, package: pkg });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete package
// @route   DELETE /api/admin/packages/:id
const deletePackage = async (req, res, next) => {
    try {
        const pkg = await Package.findByIdAndDelete(req.params.id);
        if (!pkg) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }
        return res.json({ success: true, message: 'Package deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { getPackages, createPackage, updatePackage, deletePackage };
