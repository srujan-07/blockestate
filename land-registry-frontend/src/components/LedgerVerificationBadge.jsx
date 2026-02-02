import React from 'react';

export default function LedgerVerificationBadge({
    verified,
    txId,
    blockNumber,
    endorsedBy = [],
    timestamp
}) {
    const [showDetails, setShowDetails] = React.useState(false);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    const truncateTxId = (id) => {
        if (!id) return 'N/A';
        if (id.length <= 16) return id;
        return `${id.substring(0, 8)}...${id.substring(id.length - 8)}`;
    };

    if (!verified) {
        return (
            <div className="p-4 rounded-xl bg-red-100 border border-red-300 text-red-700">
                <div className="flex items-center gap-2">
                    <span className="text-xl">❌</span>
                    <span className="font-semibold">Not Ledger-Verified</span>
                </div>
                <p className="text-sm mt-2">This data could not be verified on the blockchain ledger.</p>
            </div>
        );
    }

    return (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white text-xl">✓</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-green-800">Ledger-Verified</h3>
                        <p className="text-sm text-green-600">Blockchain Consensus Confirmed</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                    {showDetails ? 'Hide Details' : 'Show Details'}
                </button>
            </div>

            {/* Compact Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-gray-600 font-semibold mb-1">Transaction ID</p>
                    <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">
                            {truncateTxId(txId)}
                        </code>
                        {txId && (
                            <button
                                onClick={() => copyToClipboard(txId)}
                                className="text-blue-600 hover:text-blue-800 text-xs"
                                title="Copy full transaction ID"
                            >
                                📋
                            </button>
                        )}
                    </div>
                </div>

                <div>
                    <p className="text-gray-600 font-semibold mb-1">Block Number</p>
                    <code className="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono">
                        {blockNumber || 'Pending'}
                    </code>
                </div>
            </div>

            {/* Expanded Details */}
            {showDetails && (
                <div className="mt-6 pt-6 border-t border-green-200 space-y-4">
                    {/* Full Transaction ID */}
                    <div>
                        <p className="text-gray-700 font-semibold mb-2">Full Transaction ID</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-white rounded border border-gray-300 text-xs font-mono break-all">
                                {txId || 'N/A'}
                            </code>
                            {txId && (
                                <button
                                    onClick={() => copyToClipboard(txId)}
                                    className="px-3 py-2 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                                >
                                    Copy
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Timestamp */}
                    {timestamp && (
                        <div>
                            <p className="text-gray-700 font-semibold mb-2">Timestamp</p>
                            <code className="px-3 py-2 bg-white rounded border border-gray-300 text-xs font-mono">
                                {new Date(timestamp).toLocaleString()}
                            </code>
                        </div>
                    )}

                    {/* Endorsing Organizations */}
                    <div>
                        <p className="text-gray-700 font-semibold mb-2">Endorsed By</p>
                        <div className="flex flex-wrap gap-2">
                            {endorsedBy.length > 0 ? (
                                endorsedBy.map((org, index) => (
                                    <span
                                        key={index}
                                        className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300"
                                    >
                                        {org}
                                    </span>
                                ))
                            ) : (
                                <span className="text-gray-500 text-sm">No endorsement data available</span>
                            )}
                        </div>
                    </div>

                    {/* Consensus Status */}
                    <div className="p-4 rounded-lg bg-green-100 border border-green-300">
                        <div className="flex items-center gap-2">
                            <span className="text-green-700 text-lg">🔒</span>
                            <div>
                                <p className="text-green-800 font-semibold">Multi-Organization Consensus</p>
                                <p className="text-green-700 text-xs mt-1">
                                    This record has been validated and endorsed by multiple organizations on the blockchain network.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
