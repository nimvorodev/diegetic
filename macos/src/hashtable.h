#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define TABLE_HASH_FUNC(name) uint32_t name(void *key)
typedef TABLE_HASH_FUNC(table_hash_func);

#define TABLE_COMPARE_FUNC(name) bool name(void *key_a, void *key_b)
typedef TABLE_COMPARE_FUNC(table_compare_func);

struct bucket {
  void *key;
  void *value;
  struct bucket *next;
};

struct table {
  uint32_t count;
  uint32_t capacity;
  table_hash_func *hash;
  table_compare_func *compare;
  struct bucket **buckets;
};

void table_init(struct table *table, uint32_t capacity, table_hash_func *hash,
                table_compare_func *compare);
void table_free(struct table *table);
void table_clear(struct table *table);
bool table_add(struct table *table, void *key, void *value);
void table_remove(struct table *table, void *key);
void *table_find(struct table *table, void *key);
