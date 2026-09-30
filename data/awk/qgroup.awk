# `btrfs qgroup show --raw <path>` -> "<qgroupid> <exclusive MiB>" for level-0 qgroups
$1 ~ /^0\// { printf "%s %d\n", $1, $3 / 1048576 }
