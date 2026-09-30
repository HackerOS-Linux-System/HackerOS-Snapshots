function rank(k) { return (k == "+") ? 5 : (k == "-") ? 4 : (k == "r") ? 3 : (k == "c") ? 2 : 1 }
function mark(p, k) {
    if (p == "" || p == ".") return
    if (!(p in kind) || rank(k) > rank(kind[p])) kind[p] = k
}
function is_tmp(p) { return p ~ /(^|\/)o[0-9]+-[0-9]+-[0-9]+$/ }
function resolve(p) { return (p in alias) ? alias[p] : p }
function unpark(p,   t) {                           # path below a parked (about to be deleted) directory
    for (t in parked) if (index(p, t "/") == 1) return parked[t] substr(p, length(t) + 1)
    return p
}
{
    cmd = $1
    line = $0
    sub(/^[^ ]+ +/, "", line)
    path = line
    extra = ""
    if (match(line, / [a-z_]+=/)) { path = substr(line, 1, RSTART - 1); extra = substr(line, RSTART + 1) }
    gsub(/\\ /, " ", path)
    sub(/^\.\//, "", path)
    if (cmd == "snapshot" || cmd == "subvol" || cmd == "utimes" || cmd == "end") next

    if (cmd == "mkfile" || cmd == "mkdir" || cmd == "symlink" || cmd == "mknod" || cmd == "mkfifo" || cmd == "mksock") {
        if (is_tmp(path)) created[path] = 1; else mark(path, "+")
        next
    }
    if (cmd == "rename") {
        to = extra; sub(/^dest=/, "", to); gsub(/\\ /, " ", to); sub(/^\.\//, "", to)
        if (path in created) {                    # new inode getting its real name
            delete created[path]; mark(to, "+")
        } else if (is_tmp(to)) {                  # existing entry parked before deletion
            parked[to] = resolve(path)
        } else if (path in parked) {              # parked entry moved back / replaced
            mark(to, "c")
        } else {
            mark(resolve(path), "r"); renamed[resolve(path)] = to
            alias[to] = resolve(path)
        }
        next
    }
    if (cmd == "unlink" || cmd == "rmdir") {
        if (path in parked) mark(parked[path], "-"); else if (!is_tmp(path)) mark(unpark(resolve(path)), "-")
        next
    }
    if (cmd == "write" || cmd == "truncate" || cmd == "clone" || cmd == "update_extent") { p = resolve(path); if (!is_tmp(p)) mark(p, "c"); next }
    if (cmd == "chmod" || cmd == "chown" || cmd == "set_xattr" || cmd == "remove_xattr") { p = resolve(path); if (!is_tmp(p)) mark(p, "m"); next }
}
END {
    for (p in kind) {
        if (kind[p] == "r") print "r\t/" p " -> /" renamed[p]
        else print kind[p] "\t/" p
    }
}
